import { renderToString } from 'react-dom/server';
import React from 'react';
import { Emoji, EmojiStyle } from 'emoji-picker-react';
console.log(renderToString(React.createElement(Emoji, { unified: "1f44d-1f3fd", emojiStyle: EmojiStyle.APPLE })));
console.log(renderToString(React.createElement(Emoji, { unified: "1f441-fe0f-200d-1f5e8-fe0f", emojiStyle: EmojiStyle.APPLE })));
console.log(renderToString(React.createElement(Emoji, { unified: "1f441-200d-1f5e8", emojiStyle: EmojiStyle.APPLE })));
