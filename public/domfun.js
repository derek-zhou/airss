// a functional way to manipulate DOM
export function replay(subject, script) {
    clear(subject);
    play(subject, script);
}

export function hook(type, handler) {
    return (node) => {
	node.addEventListener(type, handler);
    };
}

export function fill(html) {
    return (node) => {
	node.innerHTML = html;
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

export function text(t) {
    const element = document.createTextNode(t);
    return append(element);
}

export function graft(element, script) {
    replay(element, script);
    return append(element);
}

export function elem(tag, script) {
    const element = document.createElement(tag);
    play(element, script);
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

export function shadow_div(styles, script) {
    const element = document.createElement("div");
    // close shadow root because we are not going to mess with it afterward
    const shadow_root = element.attachShadow({ mode: "closed" });
    play(shadow_root, script);
    // add links last but put in front
    for (const one of styles.reverse()) {
	const link = document.createElement("link");
	link.setAttribute("rel", "stylesheet");
	link.setAttribute("href", one);
	shadow_root.prepend(link);
    }
    return append(element);
}

function append(element) {
    return (node) => {
	node.append(element);
    };
}

function clear(node) {
    removeAllChildren(node);
    removeAllAttributes(node);
}

function removeAllChildren(node) {
    const junk = [];
    for (const child of node.childNodes) {
	junk.push(child);
    }
    for (const elem of junk) {
	elem.remove();
    }
}

function removeAllAttributes(node) {
    const junk = [];
    for (const attr of node.attributes) {
	junk.push(attr.name);
    }
    for (const name of junk) {
	node.removeAttribute(name);
    }
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
