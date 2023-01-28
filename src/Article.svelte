<script>
 export let item;
 export let clickTrash;

 import {refreshItem} from  './airss_controller.js';

 const UnknownImage = "/images/unknown_link.png";
 const airssPrefix = "https://airss.roastidio.us/";

 $: dummy = isDummyItem(item);

 import { afterUpdate } from 'svelte';

 function clickRefresh() {
     refreshItem();
 }

 function isDummyItem(item) {
     if (!item)
	 return false;
     let tags = item.tags;
     return tags.length == 1 && tags[0] == "_error";
 }

 afterUpdate(() => {
     try {
	 let url = new URL(item.url);
     } catch (e) {
	 return;
     }
     // the form inputs are not reactive
     let form = document.getElementById('comment-form');
     if (form)
	 form.reset();
     let container = document.getElementById('content_html');
     // fix up all img's src
     for (let img of container.querySelectorAll("img").values()) {
	 let href = img.getAttribute("src");
	 try {
	     let absUrl = new URL(href, item.url);
	     img.setAttribute("src", absUrl.toString());
	 } catch (e) {
	     console.warn(href + "is not a valid link");
	 }
     }
     // fixup all a's href
     for (let link of container.querySelectorAll("a").values()) {
	 let href = link.getAttribute("href");
	 try {
	     let absUrl = new URL(href, item.url);
	     link.setAttribute("href", absUrl.toString());
	 } catch (e) {
	     console.warn(href + "is not a valid link");
	 }
     }
 });

</script>

<div class="bg-white p-2 flow-root w-full overflow-x-hidden">
    {#if item}
	{#if !dummy}
	    {#if item.imageUrl}
		<div class="sm:float-right sm:ml-2">
		    <a href={item.url} target="_blank" rel="noopener noreferrer">
			<img src={item.imageUrl} alt="thumbnail" decoding="sync"
			     class="w-auto max-w-full max-w-xs max-h-48 md:max-w-lg md:max-h-64"/>
		    </a>
		</div>
	    {:else}
		<div class="float-left mr-2">
		    <a href={item.url} target="_blank" rel="noopener noreferrer">
			<img src={UnknownImage} alt="thumbnail" decoding="sync"
			     class="w-16 h-16"/>
		    </a>
		</div>
	    {/if}
	{/if}
	<h4 class="font-bold my-2 text-lg leading-snug w-full sm:text-2xl sm:w-auto">
	    {#if dummy}
		{item.title}
	    {:else}
		<a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}</a>
	    {/if}
	</h4>
	<h5 class="text-sm leading-snug sm:text-base sm:leading-normal">
	    <span class="whitespace-nowrap text-gray-400">
		{item.feedTitle}
	    </span>
	    <span class="whitespace-nowrap text-gray-400">
		| {item.datePublished.toLocaleString()}
	    </span>
	</h5>
    {/if}
    <div id="content_html"
	 class="font-serif text-gray-800 leading-snug mb-2 sm:text-lg sm:leading-relaxed">
	{#if item}
	    {@html item.contentHtml}
	{:else}
	    <h2>No news is bad news</h2>
	    <p>
		Airss is a web feed reader that runs entirely in your browser. You can subscribe any feeds by clicking the 🍼 button from above and paste the URL, or you can use of one of the following tricks: 
	    </p>
	    <h3>Desktop browser users</h3>
	    <p>
		Install this bookmarklet <a class="button" href="javascript:location.href='{airssPrefix}?url='+encodeURIComponent(window.location.href)">Subscribe it in Airss</a> <b>by dragging it to your bookmarks</b>. Whenever you encounter something interesting on the web, be it a blog, a news website or whatever, you can click this bookmarklet to subscribe. Chances are they support RSS feeds so you will always stay updated.
	    </p>
	    <h3>Mobile browser users</h3>
	    <p>
		Android users can install this APP: <a href="https://f-droid.org/en/packages/net.daverix.urlforward/">URL Forwarder</a> (Thank you, David Laurell!) then add a filter as:
	    </p>
	    <pre>{airssPrefix}?url=@url</pre>
	    <p>
		Then you can share links to the APP and select the menu to subscribe, if it support RSS feeds.
	    </p>
	    <p>
		iOS Safari users can use the bookmarklet method as mentioned earlier by syncing the bookmarklet from your Mac.
	    </p>
	    <h2>To my fellow bloggers</h2>
	    <p>
		Please make sure you have your feed <a href="https://www.rssboard.org/rss-autodiscovery">auto-discoverable</a> from your homepage. And if you can, please enable <a href="https://enable-cors.org/">permissive CORS</a> on your blog to reach out to a broader audience. Lastly, if you really like Airss, you can put a link on your homepage:
	    </p>
	    <pre>&lt;a href="{airssPrefix}?subscribe-referrer"
referrerpolicy="no-referrer-when-downgrade"&gt;
Follow me with Airss!
&lt;/a&gt;</pre>
	    <p>
		So your readers can have an even easier time to follow you.
	    </p>
	{/if}
    </div>
    {#if item}
	<form class="bg-white flex flex-col gap-y-2 p-0 w-full"
	      method="post" action="https://roastidio.us/post" target="_blank" id="comment-form">
	    <input type="hidden" name="url" value={item.url}>
	    {#if !dummy}
		<textarea class="leading-relaxed border rounded border-gray-600 h-20 p-1"
			  name="content"></textarea>
	    {/if}
	    <div class="flex flex-wrap w-full gap-x-1 justify-center">
		<button class="button py-1 px-6 inline-block rounded appearance-none font-bold
			       text-lg text-center border-0 text-white bg-pink-600"
			data-dummy={dummy}
			on:click|preventDefault={clickTrash}>🗑</button>
		{#if !dummy}
		    <button class="button py-1 px-6 inline-block rounded appearance-none font-bold
				   text-lg text-center border-0 text-white bg-purple-600"
			    on:click|preventDefault={clickRefresh}>📃</button>
		    <input class="button" type="submit" value="🔥">
		{/if}
	    </div>
	</form>
    {/if}
</div>
