<script>
 export let contentHtml;
 export let baseUrl;

 import { afterUpdate } from 'svelte';

 afterUpdate(() => {
     let container = document.querySelector("#content_html");
     try {
	 let url = new URL(baseUrl);
     } catch (e) {
	 console.warn(baseUrl + " is not a valid url");
	 return;
     }
     // fix up all img's src
     for (let img of container.querySelectorAll("img").values()) {
	 let href = img.getAttribute("src");
	 try {
	     let absUrl = new URL(href, baseUrl);
	     img.setAttribute("src", absUrl.toString());
	 } catch (e) {
	     console.warn(href + "is not a valid link");
	 }
     }
     // fixup all a's href
     for (let link of container.querySelectorAll("a").values()) {
	 let href = link.getAttribute("href");
	 try {
	     let absUrl = new URL(href, baseUrl);
	     link.setAttribute("href", absUrl.toString());
	 } catch (e) {
	     console.warn(href + "is not a valid link");
	 }
     }
 });
</script>

<div id="content_html"
     class="font-serif text-gray-800 leading-snug mb-2 sm:text-lg sm:leading-relaxed">
    {@html contentHtml}
</div>
