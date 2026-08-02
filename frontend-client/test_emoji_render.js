import { renderToString } from 'react-dom/server';
import React from 'react';
import { Emoji, EmojiStyle } from 'emoji-picker-react';
console.log(renderToString(React.createElement(Emoji, { unified: "1faf1-1f3fb-200d-1faf2-1f3fc", emojiStyle: EmojiStyle.APPLE })));
