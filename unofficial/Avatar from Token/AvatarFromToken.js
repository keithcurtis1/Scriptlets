(() => {
    "use strict";

    on("ready", () => {

        on("chat:message", (msg) => {

            if (msg.type !== "api" || !msg.content.startsWith("!avatarfromtoken")) {
                return;
            }

            const selected = msg.selected;

            if (!selected || !selected.length) {
                sendChat("Avatar from Token", "No tokens selected.");
                return;
            }

            _.each(selected, (selection) => {

                const tok = getObj("graphic", selection._id);

                if (!tok) {
                    return;
                }

                const parentId = tok.get("represents");

                if (!parentId) {
                    sendChat("Avatar from Token",
                        "One or more selected tokens do not represent a character.");
                    return;
                }

                const character = getObj("character", parentId);

                if (!character) {
                    return;
                }

                const img = tok.get("imgsrc");

                log(parentId);
                log(img);

                character.set("avatar", img);

            });
        });

    });

})();