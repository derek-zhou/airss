// assets that I manage
export var Assets = {
    preflightCSS: "./preflight.css",
    articleCSS: "./article.css",
    dialogCSS: "./dialog.css",
    logoImage: "images/airss_logo.png",
    unknownLinkImage: "images/unknown_link.png"
};

// fetch everything at startup and replace real URL with blob URL
Object.keys(Assets).forEach((key) => {
    let link = Assets[key];

    fetch(link)
	.then((response) => response.blob())
	.then((myBlob) => {
	    const objectURL = URL.createObjectURL(myBlob);
	    Assets[key] = objectURL;
	});
});
