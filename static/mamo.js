/*!
 * MAMO web view
 * https://github.com/hotrooibos/MAMO
 *
 * Copyright Antoine Marzin
 * Released under the MIT license
 * https://github.com/hotrooibos/MAMO?tab=MIT-1-ov-file
 *
 * ASCII comments : https://www.patorjk.com/software/taag/#p=display&f=ANSI%20Regular
 */

const doc               = document;
const wrapper           = doc.querySelector('#wrapper');
const dates             = doc.querySelectorAll('time');

const showHideBtn       = doc.querySelector('#show-hide');
const refreshBtn        = doc.querySelector('#refresh-redirs');
const newAliasBtn       = doc.querySelector('#new-alias');
const saveAliasBtn      = doc.querySelector('#save-alias');
const cancelAliasBtn    = doc.querySelector('#cancel-alias');
const findInput         = doc.querySelector('#find');
const redirList         = doc.querySelector('#redir-list');
const redirTabl         = doc.querySelector('#redir-tab');

const submitAlias       = doc.querySelector('#redir-form');
const uuidBtn           = doc.querySelector('#gen-uuid');
const inputAlias        = doc.querySelector('#alias');

const delDialog         = doc.querySelector('#dialog-del');




/*
 *
 *  ██████  ██████  ███    ███ ███    ███  ██████  ███    ██ ███████ 
 * ██      ██    ██ ████  ████ ████  ████ ██    ██ ████   ██ ██      
 * ██      ██    ██ ██ ████ ██ ██ ████ ██ ██    ██ ██ ██  ██ ███████ 
 * ██      ██    ██ ██  ██  ██ ██  ██  ██ ██    ██ ██  ██ ██      ██ 
 *  ██████  ██████  ██      ██ ██      ██  ██████  ██   ████ ███████ 
 *
 */

function showInfobox(msg) {
    var boxesArr = doc.querySelectorAll('.msgbox');

    // Move down msg boxes actually displayed
    for (let i = 0; i < boxesArr.length; i++) {
        const box = boxesArr[i];
        box.style.top = (parseFloat(box.style.top) + 4) + "em";
    }

    // Create the new box on the top
    let newBox = doc.createElement('div');
    newBox.setAttribute('id', 'msgbox');
    newBox.setAttribute('class', 'msgbox');
    newBox.innerHTML = msg;
    newBox.style.top = "1em";
    wrapper.appendChild(newBox);

    // Schedule the new box to be removed after 5s
    setTimeout((e) => {
        doc.querySelector('.msgbox').remove();
    }, 8000);
}


function showSaveBtn() {
    saveAliasBtn.disabled = false;
    cancelAliasBtn.disabled = false;
}


/*
 * CONVERT EPOCH time to datetime
 */
function convertEpoch(dates) {
    for (const d of dates) {
        dt = parseInt(d.innerHTML);
        dt = new Date(dt * 1000);

        const options = {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        };

        // Show year if not in current year
        if (dt.getFullYear() != new Date().getFullYear()) {
            options["year"] = "numeric";
        }

        // GB time format (ex: 28 September 2022)
        const formatedDate = new Intl.DateTimeFormat('en-GB', options).format(dt);

        d.innerHTML = formatedDate;
    }
}

convertEpoch(dates);


// function loadRedirs(jsonStr) {
//     jsonObj = JSON.parse(jsonStr);
//     redirList.innerHTML = "";
//     r = [];

//     for (const key of Object.keys(jsonObj)) { 
//         // console.log(key + ": " + JSON.stringify(jsonObj[key]));
//         r.push(key + ": " + JSON.stringify(jsonObj[key]));
//     };

//     let li = doc.createElement('li');
//     li.innerHTML = "Alias count : " + r.length;
//     redirList.appendChild(li);

//     for (const item of r) {
//         li = doc.createElement('li');
//         li.innerHTML = item;
//         redirList.appendChild(li);
//     }
// }


async function setRedir(form) {
    showInfobox("Creating new redir...");

    fetch('/set_redir', {
        method: 'post',
        body: form,
    })
        .then(response => response.status)
        .then(status => {
            if (status == 200) {
                // get_redirs();
                // redirForm.reset();
                showInfobox("Alias created succesfully !");
            } else {
                showInfobox("An error occured while creating the alias...");
            }
        });
}


async function delRedir(form) {
    showInfobox("Removing a redir...");

    try {
        const res = await fetch('/del_redir', {
            method: 'post',
            body: form,
        });

        resText = await res.text();

        if (resText.includes("'action': 'delete'")) {
            showInfobox("Alias removed succesfully !");
        } else {
            showInfobox("Error: " + resText);
        }

    } catch (error) {
        showInfobox(error);
    }
}


/*
* Fetch JSON alias list from server
*/
async function getAliasList(e) {
    let ele = e.target;
    let sortKey;

    if (ele.dataset.aliasItem) {
        sortKey = ele.dataset.aliasItem;
    }

    const res = await fetch('/get_redirs', {
        method: 'post',
        body: sortKey,
    });

    if (res.status == 200) {
        let resText = await res.text();
        let aliasList = JSON.parse(resText);
        return aliasList;
    }
}


function setActionBtns() {
    const delBtns = doc.querySelectorAll('.btn-del');
    const editBtns = doc.querySelectorAll('.btn-edit');

    // Delete buttons
    for (const btn of delBtns) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const parent = btn.parentElement.closest('tr');
            const id = parent.id;
            const alias = parent.querySelector('td[data-alias-item="alias"]').innerText;
            const dialogText = "Remove alias " + alias + " ?";
            delDialog.querySelector('p').innerHTML = dialogText;
            delDialog.__delArr = [id];
            delDialog.showModal();
        })
    }

    // Edit buttons
    editBtns.forEach(ele => {
        ele.addEventListener('click', editRow);
    });
}


/*
* Table
* Update the table with JSON data in parameter
*/
function updateTable(jsonObj) {
    const tbody = redirTabl.querySelector('tbody');
    let newTbodyContent = "";

    for (const key in jsonObj) {
        newTbodyContent +=
            "<tr id=\"" + key + "\">" +
            "<td data-alias-item=\"name\">" + jsonObj[key]['name'] + "</td>" +
            "<td data-alias-item=\"date\">" + jsonObj[key]['date'] + "</td>" +
            "<td data-alias-item=\"alias\">" + jsonObj[key]['alias'] + "</td>" +
            "<td data-alias-item=\"to\">" + jsonObj[key]['to'] + "</td>" +
            "<td data-alias-item=\"edit\" class=\"text-center no-wrap\"><a class=\"btn-edit\" href=\"\"><i data-feather=\"edit\"></a></i><a class=\"btn-del\" href=\"\"><i data-feather=\"trash-2\"></a></i></td>" +
            "</tr>"
    }

    tbody.innerHTML = newTbodyContent;
    doc.querySelector('#redir-count').innerHTML = Object.keys(jsonObj).length;

    // Feather icons : replace <i data-feather> with icons
    // https://github.com/feathericons/feather?tab=readme-ov-file#featherreplaceattrs
    feather.replace();

    setActionBtns();
}


/*
* Table
* Add a new alias row
*/
function addRow(e) {
    // Create a new row (tr) node from a cloned one
    // so we get its classes, datasets...
    const tbody = redirTabl.querySelector('tbody');
    const newRow = tbody.children[0].cloneNode(true);

    newRow.removeAttribute('id');
    newRow.setAttribute('edition', '');

    // Make cells editables
    for (const td of newRow.children) {
        switch (td.dataset.aliasItem) {
            case "name":
            case "alias":
            case "to":
                td.contentEditable = "true";
                td.classList.add('td-editable');

                // And Enter key press listener to prevent line breaks
                td.addEventListener('keydown', disableEnterKey, false);
                break;
            default:
                break;
        }
    }

    // Insert the new row
    tbody.insertAdjacentElement("afterbegin", newRow);

    // Affect click listeners to the two buttons in
    // the edition column (edit + remove icons)
    setActionBtns();

    showSaveBtn();
}


/*
* Table
* Makes cells from a specific row editables
* Called when clicking an edit row btn
*/
function editRow(e) {
    e.preventDefault();
    let clickedEle = e.target;
    let parentTr = clickedEle.parentElement.closest('tr');
    let tdArr = parentTr.querySelectorAll('td');

    parentTr.setAttribute('edition', '');

    // Get data to be edited and
    // make useful cells' (<td>) content editable
    for (const td of tdArr) {
        switch (td.dataset.aliasItem) {
            case "name":
            case "alias":
            case "to":
                td.contentEditable = true;
                td.classList.add('td-editable');
                td.__origContent = td.innerHTML;

                // And Enter key press listener to prevent line breaks
                td.addEventListener('keydown', disableEnterKey, false);
                break;
            default:
                break;
        }
    }

    showSaveBtn();
}


/*
 * Table
 * Disable use of Enter key to prevent line break
 */
function disableEnterKey(e) {
    if (e.keyCode === 13) {
        e.preventDefault();
    }
}


/*
 * Button cancel + Table
 * Cancel all ongoing editions on table by,
 * rolling back values to initial ones
 */
function cancelAliasOperations() {
    const editedTdArr = doc.querySelectorAll('td[contenteditable]');

    for (const td of editedTdArr)
        if (td.__origContent) {
            td.innerHTML = td.__origContent;
        } else {
            td.innerHTML = "";
        }
}


/*
 * Table
 * Lock editable cells (td)
 */
function lockRows() {
    // Identify row/cells under edition
    const editedTrArr = doc.querySelectorAll('tr[edition]');

    for (const tr of editedTrArr) {

        // Delete rows with no ID (cancelled new alias creation)
        if (!tr.id)
            tr.remove();

        // For all rows under edition :
        //  - Terminate row/cells edition
        //  - Restore the previous values
        if (tr.hasAttribute('edition')) {
            tr.removeAttribute('edition');
            for (const td of tr.children) {
                td.removeAttribute('contenteditable', '');
                td.classList.remove('td-editable');
            }

        }
    }

        // // Process content modification
        // // Get content from edited cells
        // const content = {};

        // editedTdArr.forEach((tdItem, index) => {
        //     key = tdItem.dataset.aliasItem;

        //     // Workaround to browsers' behaviour which adds a linebreak (<br>)
        //     // when an contenteditable element's content is set empty by the user
        //     tdItem.innerText = tdItem.innerText.replace(/(\r\n|\n|\r)/gm, "");

        //     content[key] = tdItem.innerText;
        // });

        // editedTr.__editedContent = content;

        // // Remove the table edition
        // editedTr.removeAttribute('edition');

        // editedTdArr.forEach((tdItem, index) => {
        //     tdItem.removeAttribute('contenteditable', '');
        //     tdItem.classList.remove('td-editable');

        //     key = tdItem.dataset.aliasItem;

        //     if (!editedTr.__origContent ||
        //         (editedTr.__editedContent[key] != editedTr.__origContent[key])) {
        //         console.log("modified key: " + key);
        //     }
        // });
    // }
}





/*
 *
 * ███████ ██    ██ ███████ ███    ██ ████████     ██      ██ ███████ ████████ ███████ ███    ██ ███████ ██████  ███████ 
 * ██      ██    ██ ██      ████   ██    ██        ██      ██ ██         ██    ██      ████   ██ ██      ██   ██ ██      
 * █████   ██    ██ █████   ██ ██  ██    ██        ██      ██ ███████    ██    █████   ██ ██  ██ █████   ██████  ███████ 
 * ██       ██  ██  ██      ██  ██ ██    ██        ██      ██      ██    ██    ██      ██  ██ ██ ██      ██   ██      ██ 
 * ███████   ████   ███████ ██   ████    ██        ███████ ██ ███████    ██    ███████ ██   ████ ███████ ██   ██ ███████ 
 *
 */

//
// Table : show/hide button
//
showHideBtn.addEventListener('click', (e) => {
    if (redirList.hasAttribute('class')) {
        redirList.removeAttribute('class');
        redirList.style.height = '100%';
        showHideBtn.children[0].dataset.feather = "eye-off";
    }
    else {
        redirList.setAttribute('class', 'fade-bottom');
        redirList.removeAttribute('style');
        showHideBtn.children[0].dataset.feather = "eye";
    }

    feather.replace();
});


//
// Table : New alias link button
//
newAliasBtn.addEventListener('click', addRow);


//
// Cancel button : cancel all "new" and/or "edit" alias operations in table
//
saveAliasBtn.addEventListener('click', (e) => {
    const tbody = redirTabl.querySelector('tbody');
    const editedTrArr = tbody.querySelectorAll("tr");
    let aliasData;

    for (const tr of editedTrArr) {
        if (!tr.id) {
            newRedir = {
                "name" : tr.querySelector('td[data-alias-item="name"]').innerText,
                "alias" : tr.querySelector('td[data-alias-item="alias"]').innerText,
                "to" : tr.querySelector('td[data-alias-item="to"]').innerText
            }

            setRedir(JSON.stringify(newRedir));
        }
    }

    aliasData = getAliasList(e);
    updateTable(aliasData);
    
    // TODO edit les td dont l'attribut __editedContent est non null
});


//
// Cancel button : cancel all "new" and/or "edit" alias operations in table
//
cancelAliasBtn.addEventListener('click', (e) => {
    cancelAliasOperations();
    lockRows();
    saveAliasBtn.disabled = true;
    cancelAliasBtn.disabled = true;
});


//
// Table : Refresh link button
//
refreshBtn.addEventListener('click', async (e) => {
    const aliasData = await getAliasList(e);
    updateTable(aliasData);
});


//
// Table : actions btns (edit + delete)
//
setActionBtns();


//
// Delete dialog box : closing the box
//
delDialog.addEventListener('close', async (e) => {
    if (delDialog.returnValue === "yes") {
        let delArr = JSON.stringify(delDialog.__delArr);
        await delRedir(delArr);

        let aliasData = await getAliasList(e);
        updateTable(aliasData);
    }
});


//
// Find/search in table input : typing something
//
findInput.addEventListener('input', (e) => {
    if (findInput.value.length > 0) {
        for (let i = 1, row; row = redirTabl.rows[i]; i++) {
            row.style.display = "none";
        }
    } else {
        for (let i = 0, row; row = redirTabl.rows[i]; i++) {
            row.removeAttribute('style');
        }
    }

    for (var i = 1, row; row = redirTabl.rows[i]; i++) {
        for (var j = 0, col; col = row.cells[j]; j++) {
            if (findInput.value.length > 1 && col.innerHTML.includes(findInput.value)) {
                row.removeAttribute('style');
            }
        }
    }
});


//
// Add alias form : clicking generate UUID link button
//
uuidBtn.addEventListener('click', (e) => {
    e.preventDefault();
    inputAlias.value = crypto.randomUUID();
});


//
// Add alias form : clicking Create(submit) button
//
submitAlias.addEventListener('submit', async (e) => {
    e.preventDefault();
    let newRedirForm = new FormData(submitAlias);
    newRedirForm = JSON.stringify(Object.fromEntries(newRedirForm));
    console.log(newRedirForm)
    // await setRedir(newRedirForm);

    // let aliasData = await getAliasList(e);
    // updateTable(aliasData);
});