const text = "Hola 🫱🏻‍🫲🏻 amigo 🫱🏽‍🫲🏽 y mixto 🫱🏻‍🫲🏼";
const replaced = text.replace(/\u{1faf1}([\u{1f3fb}-\u{1f3ff}])\u{200d}\u{1faf2}\1/gu, "\u{1f91d}$1");
console.log("Original:", text);
console.log("Replaced:", replaced);

const { parse } = require('@twemoji/parser');
console.log("Parsed original:");
console.log(parse(text).map(e => e.text));
console.log("Parsed replaced:");
console.log(parse(replaced).map(e => e.text));
