const ControlledBy = (() => {
    'use strict';

    const SCRIPT = 'ControlledBy';
    const VERSION = '1.0';

const CSS = {
    menu: 'background:#1f1f1f;border:1px solid #555;border-radius:6px;padding:10px;color:#fff;font-family:Arial,sans-serif;font-size:12px;',
    header: 'font-size:16px;font-weight:bold;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:5px;',
    row: 'margin:6px 0;padding:4px 0;',
    label: 'display:inline-block;width:80px;font-weight:bold;',
    button: 'display:inline-block;background:#3f3f3f;border:1px solid #666;border-radius:4px;padding:3px 8px;margin-right:6px;color:#fff;text-decoration:none;',
    error: 'background:#4a1f1f;border:1px solid #a94442;border-radius:4px;padding:8px;color:#fff;',
    success: 'background:#1f3f1f;border:1px solid #4f8a4f;border-radius:4px;padding:8px;color:#fff;'
};
    const whisperGM = (content) => {
        sendChat(SCRIPT, `/w gm ${content}`);
    };

    const makeButton = (label, command) => {
        return `<a style="${CSS.button}" href="${command}">${label}</a>`;
    };

    const showMenu = () => {
        let content = '';

        content += `<div style="${CSS.menu}">`;
        content += `<div style="${CSS.header}">Controllers</div>`;

        content += `<div style="${CSS.row}">`;
        content += `<span style="${CSS.label}">Paths</span>`;
        content += makeButton(
            'all',
            '!controlledby --paths --all'
        );
        content += makeButton(
            'none',
            '!controlledby --paths --none'
        );
        content += `</div>`;

        content += `<div style="${CSS.row}">`;
        content += `<span style="${CSS.label}">Texts</span>`;
        content += makeButton(
            'all',
            '!controlledby --texts --all'
        );
        content += makeButton(
            'none',
            '!controlledby --texts --none'
        );
        content += `</div>`;

        content += `<div style="${CSS.row}">`;
        content += `<span style="${CSS.label}">Graphics</span>`;
        content += makeButton(
            'all',
            '!controlledby --graphics --all'
        );
        content += makeButton(
            'none',
            '!controlledby --graphics --none'
        );
        content += `</div>`;


content += `<div style="${CSS.row}">`;
content += `<span style="${CSS.label}">Selected</span>`;
content += makeButton(
    'all',
    '!controlledby --selected --all'
);
content += makeButton(
    'none',
    '!controlledby --selected --none'
);
content += `</div>`;

        content += `</div>`;

        whisperGM(content);
    };

    const showError = (message) => {
        whisperGM(`<div style="${CSS.error}">${message}</div>`);
    };

    const showSuccess = (message) => {
        whisperGM(`<div style="${CSS.success}">${message}</div>`);
    };

    const getControllers = (obj) => {
        const raw = obj.get('controlledby') || '';

        return raw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    };

    const setControllers = (obj, controllers) => {
        obj.set('controlledby', controllers.join(','));
    };

    const addAllController = (obj) => {
        const controllers = getControllers(obj);

        if (!controllers.includes('all')) {
            controllers.push('all');
            setControllers(obj, controllers);
            return true;
        }

        return false;
    };

    const removeAllController = (obj) => {
        const controllers = getControllers(obj);

        if (controllers.includes('all')) {
            setControllers(
                obj,
                controllers.filter(c => c !== 'all')
            );

            return true;
        }

        return false;
    };

const processObjects = (selected, type, action) => {
    let processed = 0;

    selected.forEach(sel => {
        const obj = getObj(sel._type, sel._id);

        if (!obj) {
            return;
        }

        if (type === 'paths') {
            if (
                sel._type !== 'path' &&
                sel._type !== 'pathv2'
            ) {
                return;
            }
        }

        if (type === 'texts') {
            if (sel._type !== 'text') {
                return;
            }
        }

        if (type === 'graphics') {
            if (
                sel._type !== 'graphic' &&
                sel._type !== 'card'
            ) {
                return;
            }

            if ((obj.get('represents') || '').trim()) {
                return;
            }
        }

        if (type === 'selected') {
            const valid =
                sel._type === 'path' ||
                sel._type === 'pathv2' ||
                sel._type === 'text' ||
                (
                    (sel._type === 'graphic' || sel._type === 'card') &&
                    !(obj.get('represents') || '').trim()
                );

            if (!valid) {
                return;
            }
        }

        const changed = (
            action === 'all'
                ? addAllController(obj)
                : removeAllController(obj)
        );

        if (changed) {
            processed++;
        }
    });

    return processed;
};

    const handleInput = (msg) => {
        if (msg.type !== 'api') {
            return;
        }

        if (!playerIsGM(msg.playerid)) {
            return;
        }

        if (!msg.content.startsWith('!controlledby')) {
            return;
        }

        const args = msg.content.split(/\s+--/).slice(1);

        if (!args.length) {
            showMenu();
            return;
        }

        const hasAll = args.includes('all');
        const hasNone = args.includes('none');

        if (hasAll && hasNone) {
            showError(
                'You may only specify one action: --all or --none.'
            );
            return;
        }

        const action = hasAll
            ? 'all'
            : hasNone
                ? 'none'
                : null;

const types = [];

if (args.includes('selected')) {
    types.push('selected');
}

if (args.includes('paths')) {
    types.push('paths');
}

if (args.includes('texts')) {
    types.push('texts');
}

if (args.includes('graphics')) {
    types.push('graphics');
}

        if (types.length && !action) {
            showError(
                'You must specify an action: --all or --none.'
            );
            return;
        }

        if (!types.length) {
            showError(
                'You must specify at least one target type.'
            );
            return;
        }

        if (!msg.selected || !msg.selected.length) {
            showError(
                'No objects are selected.'
            );
            return;
        }

        let total = 0;

        types.forEach(type => {
            total += processObjects(
                msg.selected,
                type,
                action
            );
        });

        showSuccess(
            `${action === 'all' ? 'Added' : 'Removed'} "all" controller on ${total} object(s).`
        );
    };

    const registerEventHandlers = () => {
        on('chat:message', handleInput);
    };

    on('ready', () => {
        registerEventHandlers();

        log(`${SCRIPT} v${VERSION} ready.`);
    });

    return {};
})();
