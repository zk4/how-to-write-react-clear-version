// 这个函数是由 babel 调用.由开发者提供. Babel 将 JSX 转换后形成参数传入
// children 之所以在 props 里.也是因为 react 里就是这样写的. 也对应最早的 h 函数.
// type 在函数式组件里, Babel 会将函数本身赋值给 type
// props 指的是 JSX 上的 attribute 
// 从第3 个起后的参数都是 childlren  vDOM
function createVNode(type, props, ...children) {
  const vdom = {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object" ? child : createTextVNode(child)
      )
    }
  };
   return vdom;
}

function createTextVNode(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: []
    }
  };
}

  

const isEvent = key => key.startsWith("on");

// 就是这么粗暴, key 不是 children 并且不是以 on 开头的都是 proeperty.
const isProperty = key => key !== "children" && !isEvent(key);

// 下面这个的写法可以学习一下
// 两个 obj 里相同的 key 如果不一样,返回 true
// 那 a = {a:2} b = {a:2},就会返 false

const isNew = (prev, next) => key => prev[key] !== next[key];
 
function updateDOM(dom, prevProps, nextProps) {

  // 移除事件监听
  // 当：
  // 1. 是 event 的 props
  // 2. 且(旧有新没有 或者 新旧不相同)
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(key => !(key in nextProps))
    .forEach(name => {
      dom[name] = "";
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    // 因为前面已经移除了旧有新没有的,只剩下新的了.
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      console.log(name)
      dom[name] = nextProps[name];
    });

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

 
// 这个函数主要是利用在 fiber diff 后的信息.
function fiberToDOM(fiber) {
  if (!fiber) {
    return;
  }

  let parentFilber = fiber.parentFiber;
  while (!parentFilber.dom) {
    parentFilber = parentFilber.parentFiber;
  }
  const domParent = parentFilber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDOM(fiber.dom, fiber.oldFiber.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    deleteDOM(fiber, domParent);
  }

  fiberToDOM(fiber.child);
  fiberToDOM(fiber.sibling);
}

function deleteDOM(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    deleteDOM(fiber.child, domParent);
  }
}

function mount(vdom, container) {
  wipRootFiber = {
    dom: container,
    props: {
      children: [vdom]
    },
    oldFiber: currentRootFiber
  };
  fibersToDelete = [];
  nextFiber = wipRootFiber;
}

let nextFiber = null;
let currentRootFiber = null;
let wipRootFiber = null;
let fibersToDelete = null;

function workLoop(deadline) {
  let shouldYield = false;
  while (nextFiber && !shouldYield) {
    nextFiber = doOneFiber(nextFiber);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextFiber && wipRootFiber) {
    fibersToDelete.forEach(fiberToDOM);
    fiberToDOM(wipRootFiber.child);
    currentRootFiber = wipRootFiber;
    wipRootFiber = null;
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function doOneFiber(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // 如果有孩子,直接返回孩子为下一个 work
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    //1. 如果有兄弟,则返回兄弟
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    //2. 找到父 fiber, 回到 1
    nextFiber = nextFiber.parentFiber;
  }
}

let wipFiber = null;
let hookIndex = null;

// 传入 fiber,完成 diffAndPatch
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  // console.log(fiber.props,fiber.type)
  // 当是 function component 时, fiber.type 就是这个函数,比如 Counter(){}
  // children 就是 vdom
  const func_vNodes = [fiber.type(fiber.props)];

  diffAndPatch(fiber, func_vNodes);
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);
      updateDOM(dom, {}, fiber.props);

    fiber.dom = dom;
  }
  diffAndPatch(fiber, fiber.props.children);
}

function useState(initial) {
  const oldHook =
    wipFiber.oldFiber &&
    wipFiber.oldFiber.hooks &&
    wipFiber.oldFiber.hooks[hookIndex];  // 要么这个值, 要么 undefined 或 null
  const hook = {
    // state: oldHook?.state || initial, 注意, 不能用这种写法. 如果值就是 false 是有 bug 的.
    state: oldHook ? oldHook.state : initial,
    // 这里之所以要用 array (说是 queue, JS 哪有真正的 queue). 是因为 setState 方法在调用时,是在 event 派发阶段. 是异步的. 有可能会有多个事件过来. 会调用多次 setState ,比如以下情况
    // <h1 onClick={() => {setState(c => c + 1); setState(c => c + 1);}} style="user-select: none">

    queue: []
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => {
    hook.state = action(hook.state);
  });

  const setState = action => {
    hook.queue.push(action);
    wipRootFiber = {
      dom: currentRootFiber.dom,
      props: currentRootFiber.props,
      oldFiber: currentRootFiber
    };
    nextFiber = wipRootFiber;
    fibersToDelete = [];
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

function diffAndPatch(wipFiber, vNodes) {
  let index = 0;
  let oldFiber = wipFiber.oldFiber && wipFiber.oldFiber.child;
  let prevSibling = null;

  while (index < vNodes.length || oldFiber != null) {
    const vDOM = vNodes[index];
    let newFiber = null;

    const sameType = oldFiber && vDOM && vDOM.type == oldFiber.type;

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: vDOM.props,
        dom: oldFiber.dom,
        parentFiber: wipFiber,
        oldFiber: oldFiber,
        effectTag: "UPDATE"
      };
    }
    if (vDOM && !sameType) {
      newFiber = {
        type: vDOM.type,
        props: vDOM.props,
        dom: null,
        parentFiber: wipFiber,
        oldFiber: null,
        effectTag: "PLACEMENT"
      };
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      fibersToDelete.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (vDOM) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

const Didact = {
  createVNode,
  mount,
  useState
};

/** @jsx Didact.createVNode */
function Counter() {
  const [state, setState] = Didact.useState(1);
  const [state2, setState2] = Didact.useState(1);
  const [state3, setState3] = Didact.useState(true);
  return (
    <div align="middle">
     Example 1: explains why we need queue in useState
    <h1   onClick={() => {setState(c => c + 1); setState(c => c + 1);}} style="user-select: none">
      Count: {state}
    </h1>
    Example  2:
    <h1 onClick={() => setState2(c => c + 1)} style="user-select: none">
      Count: {state2}
    </h1>
    Example  3:
    <h1 onClick={() => setState3(c => !c)} style="user-select: none">

      Count: {state3}
       
       {
        state3==true?<h1>To be deleted!</h1>:null
       }
    </h1>
    </div>
    
  );
}
const vdom = <Counter />;
console.log(vdom)
const container = document.getElementById("root");
Didact.mount(vdom, container);
