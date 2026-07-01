var ImageDisplay = ImageDisplay || (function()
{

    const SCRIPT_NAME = "Image Display";
    const MARKER = "<!-- Roll20 Display Script -->";

    const CSS = {
        wrap: "padding:8px;margin:0;border:1px solid #555;border-radius:6px;background:#222;color:#eee;",
        imgWrap: "padding:0;margin:0;",
        title: "font-weight:bold;font-size:14px;",
        button: "background:#333;color:#fff;border:1px solid #777;padding:4px 8px;border-radius:4px;text-decoration:none;",
        notice: "color:#ffcc66;"
    };


    const whisperGM = (msg) =>
    {
        sendChat(
            SCRIPT_NAME,
            "/w gm " + msg
        );
    };


    const validURL = (url) =>
    {
        return /^https?:\/\/[^\s]+$/i.test(url);
    };



    const isImage = (url) =>
    {
        let clean = url.split("?")[0].toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(clean);
    };


    const buildHTML = (url) =>
    {

        return [
            MARKER,
            '<div style="',
            CSS.imgWrap,
            '">',
            '<img src="',
            url,
            '" style="max-width:100%;">',
            '</div>'
        ].join("");

    };

    const findHandout = (name) =>
    {

        return findObjs(
        {
            type: "handout",
            name: name
        })[0];

    };

    const handoutLink = (handout) =>
    {

        if(!handout) return "";

        return '<a href="https://app.roll20.net/handout/' +
            handout.id +
            '" style="color:#66ccff;text-decoration:underline;">' +
            handout.get("name") +
            '</a>';

    };

    const isScriptHandout = (handout) =>
    {

        if(!handout) return false;

        let notes = handout.get("notes") || "";

        return notes.indexOf(MARKER) !== -1;
    };


    const createOrUpdate = (url, name, force) =>
    {

        if(!validURL(url))
        {
            whisperGM(
                '<div style="' + CSS.wrap + '"><span style="' + CSS.notice + '">Invalid URL.</span></div>'
            );
            return;
        }

        if(!isImage(url))
        {
            whisperGM(
                '<div style="' + CSS.wrap + '"><span style="' + CSS.notice + '">Only image files are currently supported.</span></div>'
            );
            return;
        }

        let handout = findHandout(name);

        if(handout && name !== "Image Display" && !force && !isScriptHandout(handout))
        {

            whisperGM(
                '<div style="' + CSS.wrap + '">' +
                '<div style="' + CSS.title + '">Warning</div>' +
                'The handout <a href="https://app.roll20.net/handout/' +
                handout.id +
                '" style="color:#66ccff;text-decoration:underline;">' +
                name +
                '</a> already exists.<br>' +
                'Overwrite it?<br><i>This cannot be undone.</i><br>' +
                '<a href="!display-confirm ' +
                encodeURIComponent(url) +
                '|' +
                encodeURIComponent(name) +
                '" style="' +
                CSS.button +
                '">Yes</a>' +
                '</div>'
            );

            return;
        }

        let html = buildHTML(url);

        if(handout)
        {

            handout.set(
            {
                notes: html
            });

        }
        else
        {

            handout = createObj("handout",
            {
                name: name,
                notes: html,
                inplayerjournals: "",
                controlledby: ""
            });

        }

        whisperGM(
            '<div style="' + CSS.wrap + '">' +
            '<span style="' + CSS.title + '">' +
            handoutLink(handout) +
            ' updated.</span>' +
            '</div>'
        );

    };

    const handleInput = (msg) =>
    {

        if(msg.type !== "api") return;
        if(!playerIsGM(msg.playerid)) return;


        let args = msg.content.split(" ");


        if(args[0] === "!display")
        {

            let parts = args.slice(1).join(" ").split("|");

            let url = parts[0];
            let name = parts[1] || "Image Display";

            createOrUpdate(url, name, false);
        }


        if(args[0] === "!display-confirm")
        {

            let parts = args.slice(1).join(" ").split("|");

            let url = decodeURIComponent(parts[0]);
            let name = decodeURIComponent(parts[1]);

            createOrUpdate(url, name, true);

        }

    };

    return {
        handleInput: handleInput
    };


})();



on("chat:message", ImageDisplay.handleInput);