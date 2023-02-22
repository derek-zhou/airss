import {deleteItem, unsubscribe, Screens, setScreen, currentItem,
	unsubscribeDefault} from  './airss_controller.js';

let shouldUnsubscribe;

function clickConfirmDelete(e) {
    e.preventDefault();
    if (shouldUnsubscribe.checked)
	unsubscribe(currentItem().feedId);
    else
	deleteItem();
    setScreen(Screens.browse);
}

function clickCancel(e) {
    e.preventDefault();
    setScreen(Screens.browse);
}

export default function Trash() {
    return (
<form onSubmit={clickConfirmDelete}>
  <p>
    Are you sure you want to delete this item?
  </p>
  <div class="field">
    <label for="check-unsubscribe">
      Unsubscribe <span class="focus">{currentItem().feedTitle}</span> too
    </label>
    <input type="checkbox" id="check-unsubscribe" ref={shouldUnsubscribe}
	   checked={unsubscribeDefault()} />
  </div>
  <div class="toolbar">
    <input class="button" type="submit" value="👌" />
    <input class="button" type="reset" value="👎" onClick={clickCancel} />
  </div>
</form>
    );
}
