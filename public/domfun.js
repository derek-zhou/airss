// a functional way to manipulate DOM
export function hook(type, handler) {
    return (node) => {
	node.addEventListener(type, handler);
    };
}

export function fill(html) {
    return (node) => {
	let n = node.shadowRoot || node;
	n.innerHTML = html;
    };
}

export function attr(attributes) {
    return (node) => {
	for (const key in attributes) {
	    node.setAttribute(key, attributes[key]);
	}
    };
}

export function cl() {
    return (node) => {
	for (const one of arguments) {
	    node.classList.add(one);
	}
    };
}

// style call must be beform any node appending call because it will create shadowRoot on demand
export function style(sheet) {
    return (node) => {
	let shadow_root = node.shadowRoot;
	if (!shadow_root) {
	    shadow_root = node.attachShadow({ mode: "open" });
	}
	shadow_root.adoptedStyleSheets.push(sheet);
    }
}

export function text(t) {
    const element = document.createTextNode(t);
    return append(element);
}

export function elem() {
    const tag = arguments[0];
    const element = document.createElement(tag);
    for (const one of arguments) {
	if (one !== tag)
	    play(element, one);
    }
    return append(element);
}

// div is commonly used for layout
export function div() {
    const element = document.createElement("div");
    for (const one of arguments) {
	play(element, one);
    }
    return append(element);
}

function append(element) {
    return (node) => {
	let n = node.shadowRoot || node;
	n.append(element);
    };
}

function play(subject, script) {
    if (Array.isArray(script)) {
	for (const f of script) {
	    play(subject, f);
	}
    } else {
	script(subject);
    }
}

// unlike elem or div, body return the element itself, not a script to add it
export function body() {
    const element = document.createElement("body");
    for (const one of arguments) {
	play(element, one);
    }
    return element;
}

