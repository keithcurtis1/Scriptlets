//State Report
// !statelist — Lists state objects by size with delete buttons + total size
on('chat:message', (msg) => {
    if (msg.type !== 'api' || msg.content !== '!statelist') return;

    const entries = [];
    let totalSize = 0;

    Object.keys(state).forEach(key => {
        let size = 0;
        try {
            size = JSON.stringify(state[key]).length;
        } catch (e) {
            size = 0;
        }
        totalSize += size;
        entries.push({ key, size });
    });

    // Sort descending by size
    entries.sort((a, b) => b.size - a.size);

    const totalKB = (totalSize / 1024).toFixed(2);

    let output = `
    <div style="
        border:1px solid #444;
        background:#1f1f1f;
        padding:8px;
        font-family:monospace;
        font-size:12px;
    ">
        <div style="
            font-weight:bold;
            color:#fff;
            margin-bottom:6px;
            border-bottom:1px solid #444;
            padding-bottom:4px;
            font-weight:bold;
        ">
            State Object Sizes<br>Total: ${totalKB} KB
        </div>
    `;

    entries.forEach(e => {
        const kb = (e.size / 1024).toFixed(2);

        output += `
        <div style="
            margin:3px 0;
            display:flex;
            justify-content:space-between;
            align-items:center;
        ">
            <a href="!statedelete ${e.key}"
               style="
                    display:inline-block;
                    padding:2px 4px;
                    background:#ff0000;
                    color:#111 !important;
                    border:0px solid transparent;
                    border-radius:3px;
                    text-decoration:none !important;
                    font-weight:bold;
                    font-family:pictos;
               ">
               #
            </a>
            <span style="color:#eee;font-weight:bold;">
                ${e.key}
                <span style="color:#999;font-weight:bold;">(${kb} KB)</span>
            </span>

        </div>
        `;
    });

    output += `</div>`;
output = output.replace(/\r\n|\r|\n/g, "").trim();

    sendChat('State', `/w gm ${output}`);
});


// !statedelete <key> — Deletes a state entry
on('chat:message', (msg) => {
    if (msg.type !== 'api' || !msg.content.startsWith('!statedelete')) return;

    const args = msg.content.split(/\s+/);
    const key = args[1];

    if (!key || !state[key]) {
        sendChat('State', `/w gm Invalid or missing state key.`);
        return;
    }

    delete state[key];

    sendChat('State', `/w gm Deleted state.${key}`);
});
