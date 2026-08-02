import { renderToString } from 'react-dom/server';
import React from 'react';
import { Emoji, EmojiStyle } from 'emoji-picker-react';

// Render the same handshake emoji with light skin tone
console.log(renderToString(React.createElement(Emoji, { unified: "1f91d-1f3fb", emojiStyle: EmojiStyle.APPLE })));
// Also let's see if there's a unified code emoji-picker-react prefers for handshake light skin
// Actually let's just log what it renders for 1faf1-1f3fb-200d-1faf2-1f3fb
console.log(renderToString(React.createElement(Emoji, { unified: "1faf1-1f3fb-200d-1faf2-1f3fb", emojiStyle: EmojiStyle.APPLE })));
// And the mixed skin tone one
console.log(renderToString(React.createElement(Emoji, { unified: "1faf1-1f3fb-200d-1faf2-1f3fc", emojiStyle: EmojiStyle.APPLE })));
