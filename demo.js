let usr1 = undefined
// 1. 逻辑或 可以用来 设置默认值：如果 左边 可以 转成false，则返回右边的值
//                                        可以 转成true，则返回 左边的值
let res = usr1 || '默认值'
console.log('------||-------')
console.log(res)

// 2. 逻辑与 用来简化 if判断，如果 左边 执行结果为 true，则 执行右边
//                                              false,则 不执行右边
res =  usr1 && '表达式'
console.log('------&&-------')
console.log(res)

// 【设置默认值 推荐用 ??】
// 3. ?? 空值合并操作符，只有 左边为 undefined/null 时，才返回 右边的值
res = usr1 ?? '右边值'
console.log('------??-------')
console.log(res)

// 4. ? 可选链操作符，如果不确定 对象是否存在，则 在调用成员前，可以使用 ?
//      这样 就不会 报undefined错误了！
let o = { age:12 , dog:{name:'ruiky',run(){console.log('汪汪汪')}}}
console.log(o.age)
console.log(o.dog?.name) // 有属性   则 返回 属性值
console.log(o.cat?.name) // 没有属性 则 返回 undefined
o.dog.run?.() // 如果 有方法，则 调用
o.dog.bark?.() // 如果 没有方法，则 不调用，也不报错
