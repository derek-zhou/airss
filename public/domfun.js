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

export function classes() {
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

export function if_only(test, func) {
    if (test)
	return func;
    return [];
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
