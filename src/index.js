function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object" ? child : createTextElement(child)
      )
    }
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: []
    }
  };
}

function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

const isEvent = key => key.startsWith("on");
const isProperty = key => key !== "children" && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);
function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
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
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = "";
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
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

function commitRoot() {
  fibersToDelete.forEach(commitWork);
  commitWork(wipRootFiber.child);
  currentRootFiber = wipRootFiber;
  wipRootFiber = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.oldFiber.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function render(vDOM, container) {
  wipRootFiber = {
    dom: container,
    props: {
      children: [vDOM]
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
    nextFiber = performUnitOfWork(nextFiber);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextFiber && wipRootFiber) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

let wipFiber = null;
let hookIndex = null;

// 传入 fiber,完成 diff
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  console.log(fiber.props,fiber.type)
  // 当是 function component 时, fiber.type 就是这个函数,比如 Counter(){}
  // children 就是 vdom
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

function useState(initial) {
  const oldHook =
    wipFiber.oldFiber &&
    wipFiber.oldFiber.hooks &&
    wipFiber.oldFiber.hooks[hookIndex];  // 要么这个值, 要么 undefined 或 null
  const hook = {
    state: oldHook?.state || initial,
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

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}

function reconcileChildren(wipFiber, vDOMs) {
  let index = 0;
  let oldFiber = wipFiber.oldFiber && wipFiber.oldFiber.child;
  let prevSibling = null;

  while (index < vDOMs.length || oldFiber != null) {
    const vDOM = vDOMs[index];
    let newFiber = null;

    const sameType = oldFiber && vDOM && vDOM.type == oldFiber.type;

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: vDOM.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        oldFiber: oldFiber,
        effectTag: "UPDATE"
      };
    }
    if (vDOM && !sameType) {
      newFiber = {
        type: vDOM.type,
        props: vDOM.props,
        dom: null,
        parent: wipFiber,
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
  createElement,
  render,
  useState
};

/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1);
  const [state2, setState2] = Didact.useState(1);

  return (
    <div>
    <h1 onClick={() => {setState(c => c + 1); setState(c => c + 1);}} style="user-select: none">
      Count: {state}
    </h1>
    <h1 onClick={() => setState2(c => c + 1)} style="user-select: none">
      Count: {state2}
    </h1>
    </div>
  );
}
const vDOM = <Counter />;
const container = document.getElementById("root");
Didact.render(vDOM, container);
