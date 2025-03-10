import * as Controller from "./airss_controller.js";
import {Assets} from "./assets.js";
import {article} from "./article.js";
import {dialog} from "./dialog.js";
import {replay, hook, elem, text, attr, cl, div} from "./domfun.js";

/*
 * The view layer of AirSS.
 */

function commentWriting(e) {
    Controller.forbid_render();
    e.stopImmediatePropagation();
}

function autoAdjustHeight(e) {
    const textarea = e.currentTarget;
    const offset = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = textarea.scrollHeight + offset + 'px';
}

function dummy(item) {
    if (!item)
	return true;
    const tags = item.tags;
    return tags.length == 1 && tags[0] == "_error";
}

function alertClass(type) {
    switch (type) {
    case "error":
	return "alert-danger";
    case "warning":
	return "alert-warning";
    default:
	return "alert-info";
    }
}

// render everything from scratch
export function render(state) {
    replay(document.body, body(state));
}

function body(state) {
    return [
	div(cl("viewport"),
	    hook("touchstart", Controller.touchStartEvent),
	    hook("touchmove", Controller.touchMoveEvent),
	    div(alert(state)),
	    div(application(state)),
	    div(article_container(state)),
	    div(footer(state)))
    ];
}

function footer(state) {
    return [
	cl("footer"),
	div(cl("left-half"),
	    elem("a", [
		attr({
		    href: "https://roastidio.us/roast",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Roast me at Roastidious")
	    ])),
	div(cl("right-half"),
	    elem("a", [
		attr({
		    href: "https://github.com/derek-zhou/airss",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Fork me on GitHub")
	    ]))
    ];
}

function application(state) {
    return [
	navbar(state),
	dialog(state)
    ];
}

function navbar(state) {
    return [
	div(cl("navbar"),
	    div(elem("a", [
		    attr({href: "index.html"}),
		    elem("img", attr({src: Assets.logoImage, class: "logo"})),
		]),
		elem("span", [
		    cl("info"),
		    text(`${state.cursor+1}/${state.length}`)
		])),
	    div(cl("toolbar"),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickConfigEvent),
		    text("🔧")
		]),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickSubscribeEvent),
		    text("🍼")
		]),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickLeftEvent),
		    text("◀")
		]),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickRightEvent),
		    text("▶")
		])))
    ];
}

function alert(state) {
    if (state.alert.text == "")
	return [];
    return elem("p", [
	cl("alert", alertClass(state.alert.type)),
	hook("click", Controller.clickAlertEvent),
	text(state.alert.text)
    ]);
}

function article_container(state) {
    const item = state.currentItem;
    const hidden = state.screen != Controller.Screens.browse;

    if (item === undefined || hidden)
	return [];

    return [
	cl("article-viewport"),
	div(cl("article-container"), article_head(item), article(item)),
	article_tail(state)
    ];
}

function article_head(item) {
    if (!item)
	return [];
    return [
	article_image(item),
	article_title(item),
	article_byline(item)
    ];
}

function article_image(item) {
    const imageUrl = item.imageUrl || Assets.unknownLinkImage;
    const hero_class = item.imageUrl ? "article-hero" : "article-antihero";

    return div(cl(hero_class),
	       elem("a", [
		   attr({href: item.url, target: "_blank", rel: "noopener noreferrer"}),
		   elem("img", [attr({src: imageUrl, alt: "thumbnail"})])
	       ]));
}

function article_title(item) {
    const title_text = text(item.title)

    return elem("h4", [
	cl("article-title"),
	dummy(item) ? title_text : make_link(title_text, item.url)
    ]);
}

function make_link(inner, url) {
    return elem("a", [
	attr({href: url, target: "_blank", rel: "noopener noreferrer"}),
	inner
    ]);
}

function article_byline(item) {
    return elem("h5", [
	cl("article-byline"),
	elem("span", text(item.feedTitle)),
	elem("span", text(" | ")),
	elem("span", text(item.datePublished.toLocaleString()))
    ]);
}

function article_tail(state) {
    let item = state.currentItem;

    if (!item)
	return [];

    if (dummy(item)) {
	return elem("form", [
	    cl("comment-form"),
	    div(cl("toolbar"), trash_button())
	]);
    }
    return elem("form", [
	attr({
	    method: "post",
	    action: "https://roastidio.us/post",
	    target: "_blank",
	    class: "comment-form"
	}),
	elem("input", attr({type: "hidden", name: "url", value: item.url})),
	elem("textarea", [
	    attr({name: "content"}),
	    hook("keydown", commentWriting),
	    hook("input", autoAdjustHeight)
	]),
	div(cl("toolbar"),
	    trash_button(),
	    refresh_button(state.refreshing),
	    roast_button())
    ]);
}

function trash_button() {
    return elem("button", [
	cl("button"),
	hook("click", Controller.clickTrashEvent),
	text("🗑 ")
    ]);
}

function refresh_button(refreshing) {
    return elem("button", [
	cl("button"),
	refreshing ? attr({disabled: true}) : [],
	hook("click", Controller.clickRefreshEvent),
	text("📃")
    ]);
}

function roast_button() {
    return elem("input", [attr({type: "submit", value: "🔥", class:"button"})]);
}
