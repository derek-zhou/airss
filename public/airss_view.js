import * as Controller from "./airss_controller.js";
import * as Asset from "./assets.js";
import {article} from "./article.js";
import {dialog} from "./dialog.js";
import {replay, hook, elem, text, attr, cl, div} from "./domfun.js";

/*
 * The view layer of AirSS.
 */

export function dummy(item) {
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
    document.title = render_title(state);
    replay(
	document.body,
	hook("touchstart", Controller.touchStartEvent),
	hook("touchmove", Controller.touchMoveEvent),
	alert(state),
	navbar(state),
	article_container(state),
	dialog(state),
	footer(state)
    );
}

function render_title(state) {
    if (state.screen == Controller.Screens.shutdown) {
	return "Airss Reader (zzz)";
    } else {
	return "Airss Reader (" + state.cursor + "/" + state.length  + ")";
    }
}

function footer(state) {
    return div(
	cl("footer"),
	div(
	    cl("left-half"),
	    elem(
		"a",
		attr({
		    href: "https://roastidio.us/roast",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Roast me at Roastidious")
	    )
	),
	div(
	    cl("right-half"),
	    elem(
		"a",
		attr({
		    href: "https://github.com/derek-zhou/airss",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Fork me on GitHub")
	    )
	)
    );
}

function navbar(state) {
    return div(
	cl("navbar"),
	div(
	    elem(
		"a",
		attr({href: "index.html"}),
		elem("img", cl("logo"), attr({src: Asset.at("logoImage")})),
	    ),
	    elem(
		"span",
		cl("info"),
		text(`${state.cursor+1}/${state.length}`)
	    )
	),
	div(
	    cl("toolbar"),
	    elem(
		"button",
		cl("button"),
		hook("click", Controller.clickConfigEvent),
		text("🔧")
	    ),
	    elem(
		"button",
		cl("button"),
		hook("click", Controller.clickSubscribeEvent),
		text("🍼")
	    ),
	    elem(
		"button",
		cl("button"),
		hook("click", Controller.clickLeftEvent),
		text("◀")
	    ),
	    elem(
		"button",
		cl("button"),
		hook("click", Controller.clickRightEvent),
		text("▶")
	    )
	)
    );
}

function alert(state) {
    if (state.alert.text == "")
	return [];
    return elem(
	"p",
	cl("alert", alertClass(state.alert.type)),
	hook("click", Controller.clickAlertEvent),
	text(state.alert.text)
    );
}

function article_container(state) {
    const item = state.currentItem;
    const hidden = state.screen != Controller.Screens.browse;

    if (item === undefined || hidden)
	return [];
    else
	return div(cl("article-container"), article_head(item), article(item));
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
    const imageUrl = item.imageUrl || Asset.at("unknownLinkImage");
    const hero_class = item.imageUrl ? "article-hero" : "article-antihero";

    return div(
	cl(hero_class),
	elem(
	    "a",
	    attr({href: item.url, target: "_blank", rel: "noopener noreferrer"}),
	    elem("img", attr({src: imageUrl, alt: "thumbnail"}))
	)
    );
}

function article_title(item) {
    const title_text = text(item.title)

    return elem(
	"h4",
	cl("article-title"),
	dummy(item) ? title_text : make_link(title_text, item.url)
    );
}

function make_link(inner, url) {
    return elem(
	"a",
	attr({href: url, target: "_blank", rel: "noopener noreferrer"}),
	inner
    );
}

function article_byline(item) {
    return elem(
	"h5",
	cl("article-byline"),
	elem("span", text(item.feedTitle)),
	elem("span", text(" | ")),
	elem("span", text(item.datePublished.toLocaleString()))
    );
}
