on('ready', () => {
    log('Duplicate Name Finder script loaded.');

    const CSS = {
        container: "background:#1f1f1f;border:2px solid #444;border-radius:8px;padding:10px;color:#eee;font-size:13px;",
        header: "font-size:16px;font-weight:bold;margin-bottom:8px;color:#fff;",
        section: "margin-top:8px;",
        sectionTitle: "font-weight:bold;color:#ffd700;margin-bottom:4px;",
        item: "margin-left:10px;margin-bottom:4px;",
        link: "display:inline-block;background:#2d6cdf;color:#fff;padding:2px 6px;margin:2px 2px 0 0;border-radius:4px;text-decoration:none;font-size:11px;font-weight:bold;border:1px solid #1f4ea3;",
        linkArchived: "display:inline-block;background:#555;color:#ccc;padding:2px 6px;margin:2px 2px 0 0;border-radius:4px;text-decoration:none;font-size:11px;font-weight:bold;border:1px solid #333;",
        count: "color:#aaa;",
        none: "color:#8fbc8f;font-weight:bold;"
    };

const makeLink = (type, id, name) => {
    const obj = getObj(type, id);
    const isArchived = obj && obj.get('archived');

    const style = isArchived ? CSS.linkArchived : CSS.link;
    const label = isArchived ? `${name} <i>(Archived)</i>` : name;

    return `<a href="http://journal.roll20.net/${type}/${id}"
        style="${style}"
        title="${isArchived ? 'Archived' : 'Open'}"
        onmouseover="this.style.background='${isArchived ? '#444' : '#1f4ea3'}'"
        onmouseout="this.style.background='${isArchived ? '#555' : '#2d6cdf'}'">
        ${label}
    </a>`.replace(/\r\n|\r|\n/g, "").trim();
};

    on('chat:message', (msg) => {
        if (msg.type === 'api' && msg.content.startsWith('!findDuplicates')) {

            let duplicates = {
                characters: {},
                handouts: {}
            };

            const findDuplicates = (objects, type) => {
                let nameCounts = {};
                objects.forEach(obj => {
                    let name = obj.get('name');
                    if (!name) return;
                    if (!nameCounts[name]) nameCounts[name] = [];
                    nameCounts[name].push(obj.id);
                });

                Object.keys(nameCounts).forEach(name => {
                    if (nameCounts[name].length > 1) {
                        duplicates[type][name] = nameCounts[name];
                    }
                });
            };

            findDuplicates(findObjs({ type: 'character' }), 'characters');
            findDuplicates(findObjs({ type: 'handout' }), 'handouts');

            let html = `<div style="${CSS.container}">`;
            html += `<div style="${CSS.header}">Duplicate Name Finder</div>`;

            let hasDuplicates = false;

            // Characters
            if (Object.keys(duplicates.characters).length > 0) {
                html += `<div style="${CSS.section}">`;
                html += `<div style="${CSS.sectionTitle}">Character Sheets</div>`;

                Object.entries(duplicates.characters).forEach(([name, ids]) => {
                    html += `<div style="${CSS.item}">• ${name} <span style="${CSS.count}">(x${ids.length})</span><br>`;

                    ids.forEach((id, i) => {
                        html += `${makeLink('character', id, `Copy ${i+1}`)} `;
                    });

                    html += `</div>`;
                });

                html += `</div>`;
                hasDuplicates = true;
            }

            // Handouts
            if (Object.keys(duplicates.handouts).length > 0) {
                html += `<div style="${CSS.section}">`;
                html += `<div style="${CSS.sectionTitle}">Handouts</div>`;

                Object.entries(duplicates.handouts).forEach(([name, ids]) => {
                    html += `<div style="${CSS.item}">• ${name} <span style="${CSS.count}">(x${ids.length})</span><br>`;

                    ids.forEach((id, i) => {
                        html += `${makeLink('handout', id, `Copy ${i+1}`)} `;
                    });

                    html += `</div>`;
                });

                html += `</div>`;
                hasDuplicates = true;
            }

            if (!hasDuplicates) {
                html += `<div style="${CSS.none}">No duplicates found!</div>`;
            }

            html += `</div>`;

            sendChat('System', `/w gm ${html}`);
        }
    });
});
