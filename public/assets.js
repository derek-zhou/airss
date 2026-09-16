// assets that I manage so I can go offline.
// This is better (IMHO) than service worker in my usage
import {try_render} from './airss_controller.js';

const Images = {
    logoImage: "images/airss_logo.png",
    unknownLinkImage: "images/unknown_link.png"
};

const Styles = {
    articleCSS: "./article.css",
    dialogCSS: "./dialog.css"
};

var lut = {};
export var loaded = false;

Promise.all([load_images(), load_styles()])
    .then(() => {
	loaded = true;
	try_render();
    });

async function load_images() {
    return Promise.all(Object.keys(Images).map(load_one_image));
}

async function load_styles() {
    return Promise.all(Object.keys(Styles).map(load_one_style));
}

async function load_one_image(key) {
    let link = Images[key];
    let response = await fetch(link);

    if (response.status != 200) {
	console.error("Image " + link + " failed to load");
	return;
    }
    let data = await response.blob();
    lut[key] = URL.createObjectURL(data);
    console.info("Image at " + key + " loaded");
    return;
}

async function load_one_style(key) {
    let link = Styles[key];
    let response = await fetch(link);

    if (response.status != 200) {
	console.error("Image " + link + " failed to load");
	return;
    }
    let data = await response.text();
    let style = new CSSStyleSheet();
    lut[key] = style;
    console.info("Style at " + key + " loaded");
    return style.replace(data);
}

export function at(key) {
    return lut[key];
}
