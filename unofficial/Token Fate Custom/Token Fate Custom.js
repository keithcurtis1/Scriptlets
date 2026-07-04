// Token Fate Custom
// Original by: David E. Durrett Jr. (Bugfixes by The Aaron)
// Revision by: keithcurtis
// API Commands:
// !token-fate   - Execute while you have a group of tokens selected for best results
// !token-fate-w - Execute while you have a group of tokens selected for best results whispered to the GM!

var TokenFate = TokenFate || (() => {
    'use strict';

    const version = '1.1.1';
    const lastUpdate = 1588184063;

    let multiFate = 1;
    let msgStart = "";
    let selectedToken = "";
    let invalidTokenCount = 0;
    let selectedTokenList = [];
    let withReplacement = false;

    const checkInstall = () => {
        log('TokenFate v' + version + '  [' + (new Date(lastUpdate * 1000)) + ']');
    };

const buildThumbnailStrip = () => {

    return selectedTokenList.map(t => {

        return "<a href='!token-fate-ping " + t.id + " " + t.pageId + "' " +
            "title='" + _.escape(t.name) + "' " +
            "style='float:right;" +
                "margin-left:2px;" +
                "margin-top:-25px;" +
                "background:none;" +
                "border:none;" +
                "padding:0;'>" +

                "<img src='" + t.img + "' " +
                    "style='width:28px;" +
                    "height:28px;" +
                    "display:block;" +
                    "border:none;'>" +

            "</a>";

    }).join("");

};
const outputSelectedToken = (tokenName, token) => {

    if (!token) {

        if (msgStart === "") {
            sendChat("", "/desc ");
        }

        sendChat("", msgStart +
            "<div style='width:100%;color:#D1B280;border:1px solid #594D46;border-radius:10px;background:#080706;padding:6px 8px;font-family:Garamond;text-align:center;'>No Token</div>");

        return;
    }

    const tokenId = token.get('_id');
    const pageId = token.get('_pageid');

    const tokenImg = token.get('imgsrc')
        .replace(/max\.png|med\.png/, 'thumb.png');

    let disclaimer = '';

    if (invalidTokenCount > 0) {
        disclaimer =
            "<div style='font-size:11px;color:#999;margin-top:4px;font-weight:normal;'>" +
            invalidTokenCount +
            " token(s) do not represent characters and have no names." +
            "</div>";
    }

    if (msgStart === "") {
        sendChat("", "/desc ");
    }

    sendChat("",
        msgStart +

        "<div style='width:100%;margin-left:0;color:#D1B280;border:1px solid #594D46;border-radius:10px;background:#080706;box-shadow:0 0 15px #594D46;font-size:20px;font-weight:bold;padding:6px 8px;font-family:Garamond;white-space:pre-wrap;position:relative;overflow:visible;'>" +

        buildThumbnailStrip() +

        "<a href='!token-fate-ping " + tokenId + " " + pageId + "' " +
        "style='float:left;margin-top:-20px;margin-right:8px;background:none;border:none;padding:0;'>" +
        "<img src='" + tokenImg + "' style='max-width:70px;max-height:70px;border:none;display:block;'>" +
        "</a>" +

        "<div style='text-align:center;margin-top:8px;'>" +
        "Fate has chosen:<br>" +

        "<a href='!token-fate-gm-ping " + tokenId + " " + pageId + "' " +
        "style='color:#D1B280;background:none;border:none;padding:0;margin:0;text-decoration:none;font:inherit;'>" +

        tokenName +

        "</a>" +

        "</div>" +

        "<div style='clear:both;'></div>" +

        disclaimer +

        "</div>"
    );

};

    const randomSelection = (tokens) => {

        if (tokens.length) {

            const i = randomInteger(tokens.length) - 1;

            selectedToken = tokens[i].get("name");

            if (selectedToken == null) {
                randomSelection(_.without(tokens, tokens[i]));
                return;
            }

            if (selectedToken === "") {
                if (tokens[i].get("represents")) {
                    const representedCharacter = getObj(
                        "character",
                        tokens[i].get("represents")
                    );

                    if (representedCharacter) {
                        selectedToken = representedCharacter.get("name");
                    }
                }
            }

            if (selectedToken === "") {
                invalidTokenCount++;
                randomSelection(_.without(tokens, tokens[i]));
                return;
            }

            outputSelectedToken(selectedToken, tokens[i]);

if (multiFate > 1) {
    multiFate--;

    if (withReplacement) {
        randomSelection(tokens);
    } else {
        randomSelection(_.without(tokens, tokens[i]));
    }
}

        } else {
            outputSelectedToken("No Token", tokens[0]);
            multiFate = 1;
        }
    };

    const handleMessages = (msg_orig) => {

        if ('api' !== msg_orig.type) {
            return;
        }

        let msg = _.clone(msg_orig);

        if (_.has(msg, 'inlinerolls')) {
            msg.content = _.chain(msg.inlinerolls)
                .reduce((m, v, k) => {
                    m['$[[' + k + ']]'] = v.results.total || 0;
                    return m;
                }, {})
                .reduce((m, v, k) => {
                    return m.replace(k, v);
                }, msg.content)
                .value();
        }

        invalidTokenCount = 0;

        const args = msg.content.split(/\s+/);
        const command = args.shift();

        if (command === '!token-fate' || command === '!token-fate-w') {

            msgStart = (command === '!token-fate-w') ? "/w gm " : "";

if (args.length > 0) {
    const match = args[0].match(/^(\d+)(\+)?$/);

    if (match) {
        multiFate = parseInt(match[1], 10);
        withReplacement = !!match[2];
    } else {
        multiFate = 1;
        withReplacement = false;
    }
} else {
    multiFate = 1;
    withReplacement = false;
}

            const objs = _.chain(msg.selected || [])
                .map(o => getObj(o._type, o._id))
                .reject(_.isUndefined)
                .value();
selectedTokenList = [];

objs.forEach(token => {

    let displayName = token.get("name") || "";

    if (!displayName && token.get("represents")) {

        const character = getObj(
            "character",
            token.get("represents")
        );

        if (character) {
            displayName = character.get("name");
        }
    }

    if (!displayName) {
        return;
    }

    selectedTokenList.push({

        id: token.id,

        pageId: token.get("_pageid"),

        img: token.get("imgsrc")
            .replace(/max\.png|med\.png/, "thumb.png"),

        name: displayName

    });

});

            randomSelection(objs);
        }

        if (msg.content.startsWith('!token-fate-ping')) {

            const parts = msg.content.split(' ');
            const token = getObj('graphic', parts[1]);
            const pageId = parts[2];

            if (token) {
                sendPing(
                    token.get('left'),
                    token.get('top'),
                    pageId,
                    null,
                    true
                );
            }

            return;
        }

        if (msg.content.startsWith('!token-fate-gm-ping')) {

            const parts = msg.content.split(' ');
            const token = getObj('graphic', parts[1]);
            const pageId = parts[2];

            if (token) {
                sendPing(
                    token.get('left'),
                    token.get('top'),
                    pageId,
                    msg.playerid,
                    true,
                    msg.playerid
                );
            }

            return;
        }
    };

    const registerEventHandlers = () => {
        on('chat:message', handleMessages);
    };

    return {
        CheckInstall: checkInstall,
        RegisterEventHandlers: registerEventHandlers
    };

})();

on('ready', () => {
    'use strict';

    TokenFate.CheckInstall();
    TokenFate.RegisterEventHandlers();
});