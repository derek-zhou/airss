import {Screens} from './airss_controller.js';
/*
 * The view layer of AirSS.
 */
function run_custom_actions(e) {
    e.preventDefault();
    let target = e.currentTarget;

    for (const current of target.children) {
	if (current instanceof CustomAction && current.getAttribute("type") == e.type) {
	    let value = current.getAttribute("value");
	    console.log("type: " + e.type);
	    document.dispatchEvent(new CustomEvent(value, {target: target, detail: e}));
	}
    }
}

class CustomAction extends HTMLElement {
    constructor() {
	super();
    }

    connectedCallback() {
	let type = this.getAttribute("type");
	let value = this.getAttribute("value");
	let target = this.parentElement;

	switch (type) {
	case "mount":
	    document.dispatchEvent(new CustomEvent(value, {target: target}));
	    break;
	case "unmount":
	    break;
	default:
	    target.addEventListener(type, run_custom_actions);
	}
    }

    disconnectedCallback() {
	let type = this.getAttribute("type");
	let value = this.getAttribute("value");
	let target = this.parentElement;

	if (type == "unmount") {
	    document.dispatchEvent(new CustomEvent(value, {target: target}));
	}
    }
}

customElements.define("custom-action", CustomAction);

function clear_content(container) {
    let junk = [];
    for (const child of container.childNodes) {
	junk.push(child);
    }
    for (const elem of junk) {
	elem.remove();
    }
}

function repaint(container, tree) {
    clear_content(container);
    tree.forEach((each) => {
	container.append(build_node(each));
    });
}

function build_node(tree_node) {
    if (typeof(tree_node) == "string") {
	return document.createTextNode(tree_node);
    } else {
	let element = document.createElement(tree_node.tag);
	if (tree_node.attributes) {
	    Object.keys(tree_node.attributes).forEach((key) => {
		let value = tree_node.attributes[key];
		if (value) {
		    element.setAttribute(key, value);
		}
	    });
	}
	if (tree_node.children) {
	    tree_node.children.forEach((each) => {
		element.append(build_node(each));
	    });
	}
	return element;
    }
}

function el(tag, attributes, children) {
    return {
	tag,
	... attributes == {} ? {} : {attributes},
	... children == [] ? {} : {children}
    }
}

function leftDisabled(state) {
    return state.cursor <= 0 || state.screen != Screens.browse;
}

function rightDisabled(state) {
    return state.cursor >= state.length - 1 || state.screen != Screens.browse;
}

function alertClass(state) {
    switch (state.alert.type) {
    case "error":
	return "alert alert-danger";
    case "warning":
	return "alert alert-warning";
    default:
	return "alert alert-info";
    }
}

export function render_application(state) {
    let container = document.querySelector("div#application");
    let tree = application(state);
    repaint(container, tree);
}

export function render_article(state) {
    let container = document.querySelector("div#article");
    let tree = article(state);
    repaint(container, tree);
}

function application(state) {
    return [
	...navbar(state),
	...alert(state),
	...dialog(state),
	el("custom-action", {type: "mount", value: "AirSSViewMountApplication"}, [])
    ];
}

function navbar(state) {
    return [
	el("div", {class: "bg-gray-100 p-2 flex"}, [
	    el("div", {}, [
		el("a", {href: "/"}, [
		    el("img", {src: "images/airss_logo.png", class: "inline-block h-8"}, []),
		]),
		el("span", {class: "text-gray-600 align-bottom whitespace-nowrap"},
			[`${state.cursor+1}/${state.length}`])
	    ]),
	    el("div", {class: "flex-grow text-right"}, [
		el("button", {class: "button py-1 text-purple-600 inline-block rounded appearance-none font-bold text-lg text-center ml-1 px-1 sm:px-4"}, [
		    el("custom-action", {type: "click", value: "AirSSViewClickConfig"}, []),
		    "🔧"
		]),
		el("button", {class: "button py-1 text-purple-600 inline-block rounded appearance-none font-bold text-lg text-center ml-1 px-1 sm:px-4"}, [
		    el("custom-action", {type: "click", value: "AirSSViewClickSubscribe"}, []),
		    "🍼"
		]),
		el("button", {class: "button py-1 text-purple-600 inline-block rounded appearance-none font-bold text-lg text-center ml-1 px-1 sm:px-4"}, [
		    el("custom-action", {type: "click", value: "AirSSViewClickLeft"}, []),
		    "◀"
		]),
		el("button", {class: "button py-1 text-purple-600 inline-block rounded appearance-none font-bold text-lg text-center ml-1 px-1 sm:px-4"}, [
		    el("custom-action", {type: "click", value: "AirSSViewClickRight"}, []),
		    "▶"
		])
	    ])
	])
    ];
}

function alert(state) {
    if (state.alert.text == "") {
	return [];
    } else {
	return [
	    el("p", {class: alertClass(state)}, [
		el("custom-action", {type: "click", value: "AirSSViewClickAlert"}, []),
		state.alert.text
	    ])
	];
    }
}

function dialog(state) {
    switch (state.screen) {
    case Screens.browse:
	return [];
    case Screens.trash:
	return trash_dialog(state);
    case Screens.config:
	return config_dialog(state);
    case Screens.subscribe:
	return subscribe_dialog(state);
    default:
	return reload_dialog(state);
    }
}

function reload_dialog(state) {
    return [
	custom_form("AirSSViewClickReload", null, [
	    el("p", {}, ["AirSS is shut down. Reload?"])
	])
    ];
}

function subscribe_dialog(state) {
    return [
	custom_form("AirSSViewSubmitSubscribe", "AirSSViewResetDialog", [
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "The URL to the feed or the index page:",
		    el("input", {type: "text", class: "long", name: "feedUrl",
				 placeholder: "enter the url to subscribe"}, [])
		]),
	    ])
	])
    ];
}

function trash_dialog(state) {
    return [
	custom_form("AirSSViewSubmitTrash", "AirSSViewResetDialog", [
	    el("p", {}, ["Are you sure you want to delete this item?"]),
	    el("div", {class: "field"}, [
		el("label", {}, [
		    "Unsubscribe ",
		    el("span", {class: "focus"}, [state.currentItem.feedTitle]),
		    " too",
		    el("input", {type: "checkbox", name: "shouldUnscribe",
				 checked: state.unsubscribeDefault}, [])
		]),
	    ])
	])
    ];
}

function config_dialog(state) {
    return [
	custom_form("AirSSViewSubmitConfig", "AirSSViewResetDialog", [
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Load more when unread items is below:",
		    el("select", {name: "waterMark"},
		       water_mark_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Between reloading a feed, wait at least:",
		    el("select", {name: "minReloadWait"},
		       min_reload_wait_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Keep read items in the database for:",
		    el("select", {name: "maxKeptPeriod"},
		       max_kept_period_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Keep in the database at most per feed:",
		    el("select", {name: "maxItemsPerFeed"},
		       max_items_per_feed_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Truncate each feed while loading to at most:",
		    el("select", {name: "truncateItemsPerFeed"},
		       truncate_items_per_feed_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Load feeds with roastidio.us (",
		    el("a", {href: "https://github.com/derek-zhou/airss#Proxy"}, ["Why"]),
		    "):",
		    el("input", {type: "checkbox", name: "bounceLoad",
				 checked: bounceLoadDefault()}, [])
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Restore feeds from:",
		    el("input", {type: "text", class: "short code", name: "restoreHandle"}, []),
		    ...savedHandlePrompt(state)
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {class: "alert alert-danger"}, [
		    "Danger! Type \"clear database\" to delete all data",
		    el("input", {type: "text", name: "clearDatabase"}, [])
		])
	    ])
	])
    ];
}

function savedHandlePrompt(state) {
    if (state.postHandle) {
	return [
	    "Your feeds were saved to: ",
	    el("span", {class: "code"}, [state.postHandle])
	];
    } else {
	return [];
    }
}

function bounceLoadDefault() {
    return localStorage.getItem("BOUNCE_LOAD") != "false";
}

function water_mark_options() {
    return build_options([
	{value: 1, text: "1 item"},
	{value: 10, text: "10 items"},
	{value: 100, text: "100 items"},
	{value: 1000, text: "1000 items"}
    ], parseInt(localStorage.getItem("WATER_MARK")) || 1);
}

function min_reload_wait_options() {
    return build_options([
	{value: 1, text: "1 hour"},
	{value: 4, text: "4 hours"},
	{value: 12, text: "12 hours"},
	{value: 24, text: "24 hours"}
    ], parseInt(localStorage.getItem("MIN_RELOAD_WAIT")) || 12);
}

function max_kept_period_options() {
    return build_options([
	{value: 30, text: "30 days"},
	{value: 60, text: "60 days"},
	{value: 180, text: "180 days"},
	{value: 999, text: "999 days"}
    ], parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180);
}

function max_items_per_feed_options() {
    return build_options([
	{value: 25, text: "25 items"},
	{value: 50, text: "50 items"},
	{value: 100, text: "100 items"},
	{value: 200, text: "200 items"}
    ], parseInt(localStorage.getItem("MAX_ITEMS_PER_FEED")) || 100);
}

function truncate_items_per_feed_options() {
    return build_options([
	{value: 1, text: "1 item"},
	{value: 10, text: "10 items"},
	{value: 25, text: "25 items"},
	{value: 100, text: "100 items"}
    ], parseInt(localStorage.getItem("TRUNCATE_ITEMS_PER_FEED")) || 25);
}

function build_options(options, default_value) {
    return options.forEach((each) =>
	el("option", {selected: each.value == default_value, value: each.value}, [each.text])
    );
}

function custom_form(submit_action, reset_action, inner) {
    return el("form", {}, [
	el("custom-action", {type: "submit", value: submit_action}, []),
	... reset_action ? [el("custom-action", {type: "reset", value: reset_action}, [])] : [],
	el("section", {}, inner),
	el("div", {class: "toolbar"}, [
	    el("input", {class: "button", type: "submit", value: "👌"}, []),
	    ... reset_action ? [el("input", {class: "button", type: "reset", value: "👎"}, [])] : []
	])
    ]);
}

function article(state) {
    return [
	el("div", {class: "bg-white p-2 flow-root w-full overflow-x-hidden"}, [
	    ... article_head(state.currentItem),
	    el("div", {id: "content-html", class: "font-serif text-gray-800 leading-snug mb-2 sm:text-lg sm:leading-relaxed"}, []),
	    ... article_tail(state.currentItem),
	el("custom-action", {type: "mount", value: "AirSSViewMountArticle"}, [])
	])
    ];
}

function dummy(item) {
    let tags = item.tags;
    return tags.length == 1 && tags[0] == "_error";
}

function article_head(item) {
    if (!item)
	return [];

    return [
	... dummy(item) ? [] : article_image(item),
	... article_title(item),
	... article_byline(item)
    ];
}

function article_image(item) {
    if (item.image.Url) {
	return [
	    el("div", {class: "sm:float-right sm:ml-2"}, [
		el("a", {href: item.url, target: "_blank", rel: "noopener noreferrer"}, [
		    el("img", {
			src: item.imageUrl, alt: "thumbnail", decoding: "sync",
			class: "w-auto max-w-full max-w-xs max-h-48 md:max-w-lg md:max-h-64"}, [])
		])
	    ])
	];
    } else {
	return [
	    el("div", {class: "float-left mr-2"}, [
		el("a", {href: item.url, target: "_blank", rel: "noopener noreferrer"}, [
		    el("img", {src: "images/unknown_link.png", alt: "thumbnail",
			       decoding: "sync", class: "w-16 h-16"}, [])
		])
	    ])
	];
    }
}

function article_title(item) {
    if (dummy(item)) {
	return [
	    el("h4", {class: "font-bold my-2 text-lg leading-snug w-full sm:text-2xl sm:w-auto"},
	       [item.title])
	];
    } else {
	return [
	    el("h4", {
		class: "font-bold my-2 text-lg leading-snug w-full sm:text-2xl sm:w-auto"
	    }, [
		el("a", {href: item.url, target: "_blank", rel: "noopener noreferrer"},
		   [item.title])
	    ])
	];
    }
}

function article_byline(item) {
    return [
	el("h5", {class: "text-sm leading-snug sm:text-base sm:leading-normal"}, [
	    el("span", {class: "whitespace-nowrap text-gray-400"}, [item.feedTitle]),
	    el("span", {class: "whitespace-nowrap text-gray-400"}, [" | "]),
	    el("span", {class: "whitespace-nowrap text-gray-400"}, [
		item.datePublished.toLocaleString()
	    ])
	])
    ];
}

function article_tail(item) {
    if (!item)
	return [];

    return [
	el("form", {
	    class: "bg-white flex flex-col gap-y-2 p-0 w-full",
	    method: "post", action: "https://roastidio.us/post", target: "_blank"
	}, [
	    el("input", {class: "", type: "hidden", name: "url", value: item.url}, []),
	    ... dummy(item) ? [] : comment_box(),
	    el("div", {class: "flex flex-wrap w-full gap-x-1 justify-center"}, [
		trash_button(),
		... dummy(item) ? [] : [refresh_button()],
		... dummy(item) ? [] : [submit_button()]
	    ])
	])
    ];
}

function comment_box() {
    return [
	el("textarea", {class: "leading-relaxed border rounded resize-none box-border border-gray-600 h-20 p-1", name: "content"}, [])
    ];
}

function trash_button() {
    return el("button", {class: "button py-1 px-6 inline-block rounded appearance-none font-bold text-lg text-center border-0 text-white bg-pink-600"}, [
	el("custom-action", {type: "click", value: "AirSSViewClickTrash"}, []),
	"🗑 "
    ]);
}

function refresh_button() {
    return el("button", {class: "button py-1 px-6 inline-block rounded appearance-none font-bold text-lg text-center border-0 text-white bg-pink-600"}, [
	el("custom-action", {type: "click", value: "AirSSViewClickRefresh"}, []),
	"📃"
    ]);
}

function submit_button() {
    return el("imput", {class: "button", type: "submit", value: "🔥"}, []);
}
