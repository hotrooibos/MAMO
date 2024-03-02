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

const doc           = document;
const wrapper       = doc.querySelector('#wrapper');
const dates         = doc.querySelectorAll('time');

const btnShowHide   = doc.querySelector('#show-hide');
const btnsRefresh   = doc.querySelector('#refresh-redirs');
const newAlias      = doc.querySelector('#new-alias');
const inputFind     = doc.querySelector('#find');
const listRedir     = doc.querySelector('#redir-list');
const tabRedir      = doc.querySelector('#redir-tab');
const btnsDel       = doc.querySelectorAll('.btn-del');
const btnsEdit      = doc.querySelectorAll('.btn-edit');

const formRedir     = doc.querySelector('#redir-form');
const btnUuid       = doc.querySelector('#gen-uuid');
const inputAlias    = doc.querySelector('#alias');

const dialogDel     = doc.querySelector('#dialog-del');




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
        const postdate = new Intl.DateTimeFormat('en-GB', options).format(dt);

        d.innerHTML = postdate;
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
    e.preventDefault();
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


/*
* Table
* Update the table with JSON data in parameter
*/
function updateTable(jsonObj) {
    let tbody = tabRedir.querySelector('tbody');
    let newTbodyContent = "";

    for (const key in jsonObj) {
        newTbodyContent +=
            "<tr id=\"" + key + "\">" +
            "<td data-alias-item=\"name\">" + jsonObj[key]['name'] + "</td>" +
            "<td data-alias-item=\"date\">" + jsonObj[key]['date'] + "</td>" +
            "<td data-alias-item=\"alias\">" + jsonObj[key]['alias'] + "</td>" +
            "<td data-alias-item=\"to\">" + jsonObj[key]['to'] + "</td>" +
            "<td data-alias-item=\"edit\"><a class=\"btn-edit\" href=\"\"><i data-feather=\"edit\"></a></i><a class=\"btn-del\" href=\"\"><i data-feather=\"trash-2\"></a></i></td>" +
            "</tr>"
    }

    tbody.innerHTML = newTbodyContent;
    doc.querySelector('#redir-count').innerHTML = Object.keys(jsonObj).length;

    // Feather icons : replace <i data-feather> with icons
    // https://github.com/feathericons/feather?tab=readme-ov-file#featherreplaceattrs
    feather.replace();

    editItems = tbody.querySelectorAll("a");

    for (const a of editItems) {
        if (a.classList.contains('btn-del')) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                let id = a.parentElement.closest('tr').id;
                let dialogText = "Remove id " + id + " ?";
                dialogDel.querySelector('p').innerHTML = dialogText;
                dialogDel.__delArr = [id];
                dialogDel.showModal();
            });
        }

        if (a.classList.contains('btn-edit')) {
            a.addEventListener('click', editRow);
        }
    }
}


/*
* Table
* Add a new alias row
*/
function addRow(e) {
    e.preventDefault();
    let newRow = tabRedir.insertRow(1);
    newRow.id = "0"
    newRow.innerHTML =
        "<td data-alias-item=\"name\">New alias</td>" +
        "<td data-alias-item=\"date\"></td>" +
        "<td data-alias-item=\"alias\"></td>" +
        "<td data-alias-item=\"to\"></td>" +
        "<td data-alias-item=\"edit\"><a class=\"btn-edit\" href=\"\"><i data-feather=\"edit\"></a></i><a class=\"btn-del\" href=\"\"><i data-feather=\"trash-2\"></a></i></td>";

    // Feather icons : replace <i data-feather> with icons
    // https://github.com/feathericons/feather?tab=readme-ov-file#featherreplaceattrs
    feather.replace();

    editItems = newRow.querySelectorAll("a");

    for (const a of editItems) {
        if (a.classList.contains('btn-del')) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                let id = a.parentElement.closest('tr').id;
                let dialogText = "Remove id " + id + " ?";
                dialogDel.querySelector('p').innerHTML = dialogText;
                dialogDel.__delArr = [id];
                dialogDel.showModal();
            });
        }

        if (a.classList.contains('btn-edit')) {
            a.addEventListener('click', editRow);
        }
    }
    // Create the new row
    // let newTr = doc.createElement('tr');
    // newTr.setAttribute('id', '');



    // newBox.setAttribute('class', 'msgbox');
    // newBox.innerHTML = msg;
    // newBox.style.top = "1em";
    // wrapper.appendChild(newBox);
}


/*
* Table
* Makes cells from a specific row editables
* Called when clicking an edit row btn
*/
function editRow(e) {
    e.preventDefault();
    let ele = e.target;
    let trParent = ele.parentElement.closest('tr');
    let tdArr = trParent.querySelectorAll('td');

    // If editable row/cells exists, lock them
    // before making the current selection editable
    let editedTr = doc.querySelector('tr[edition]');
    let editedTdArr = doc.querySelectorAll('td[contenteditable]');

    if (editedTr) {
        // Remove the table edition
        editedTr.removeAttribute('edition');

        editedTdArr.forEach((tdItem, index) => {
            tdItem.removeAttribute('contenteditable', '');
            tdItem.removeAttribute('class');
        });
    }

    trParent.setAttribute('edition', '');

    // Get data from the row to be edited and
    // make useful cells' (<td>) content editable
    const content = {};

    tdArr.forEach((tdItem, index) => {
        switch (index) {
            case 0:
            case 2:
            case 3:
                tdItem.contentEditable = true;
                tdItem.setAttribute('class', 'td-editable');
                aliasItem = tdItem.dataset.aliasItem;
                content[aliasItem] = tdItem.innerHTML;

                // And Enter key press listener to prevent line breaks
                tdItem.addEventListener('keydown', disableEnterKey, false);
                break;
            default:
                break;
        }


    });

    if (!trParent.__origContent)
        trParent.__origContent = content;

    // Add a click listener to anywhere on the document
    window.addEventListener("click", lockRow);
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
 * Table
 * Lock editable cells (td) when the user clicks anywhere
 * out of the row currently edited, and return edited content
 */
function lockRow(e) {
    // Identify currently clicked element
    let ele = e.target;
    let trParent = ele.closest('tr');
    // Identify row/cells under edition
    let editedTr = doc.querySelector('tr[edition]');
    let editedTdArr = doc.querySelectorAll('td[contenteditable]');

    // If click event happened anywhere but on
    // the currently edited row elements: 
    // - Process the content modification
    // - Terminate table edition
    // - Remove the click listener triggering this function
    if (!trParent || !trParent.hasAttribute('edition')) {
        // Process content modification
        // Get content from edited cells
        const content = {};

        editedTdArr.forEach((tdItem, index) => {
            key = tdItem.dataset.aliasItem;

            // Workaround to browsers' behaviour which adds a linebreak (<br>)
            // when an contenteditable element's content is set empty by the user
            tdItem.innerText = tdItem.innerText.replace(/(\r\n|\n|\r)/gm, "");

            content[key] = tdItem.innerText;
        });

        editedTr.__editedContent = content;

        // Remove the table edition
        editedTr.removeAttribute('edition');

        editedTdArr.forEach((tdItem, index) => {
            tdItem.removeAttribute('contenteditable', '');
            tdItem.classList.remove('td-editable');

            key = tdItem.dataset.aliasItem;

            if (editedTr.__editedContent[key] != editedTr.__origContent[key]) {
                console.log("modified key: " + key);
            }
        });

        // Job done, remove calling listener
        window.removeEventListener('click', lockRow);
    }
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
// Table : show/hide link button
//
btnShowHide.addEventListener('click', (e) => {
    // getRedirs();

    if (listRedir.hasAttribute('class')) {
        listRedir.removeAttribute('class');
        listRedir.style.height = '100%';
    }
    else {
        listRedir.setAttribute('class', 'fade-bottom');
        listRedir.removeAttribute('style');
    }
});


//
// Table : New alias link button
//
newAlias.addEventListener('click', addRow);


//
// Table : Refresh link button
//
btnsRefresh.addEventListener('click', async (e) => {
    let aliasData = await getAliasList(e);
    updateTable(aliasData);
});


//
// Table : delete buttons
//
btnsDel.forEach(ele => ele.addEventListener('click', (e) => {
    e.preventDefault();
    let id = ele.parentElement.closest('tr').id;
    let dialogText = "Remove id " + id + " ?";
    dialogDel.querySelector('p').innerHTML = dialogText;
    dialogDel.__delArr = [id];
    dialogDel.showModal();
}));


//
// Table : edit buttons
//
btnsEdit.forEach(ele => {
    ele.addEventListener('click', editRow);
});


//
// Delete dialog box : closing the box
//
dialogDel.addEventListener('close', async (e) => {
    if (dialogDel.returnValue === "yes") {
        let delArr = JSON.stringify(dialogDel.__delArr);
        await delRedir(delArr);

        let aliasData = await getAliasList(e);
        updateTable(aliasData);
    }
});


//
// Find/search in table input : typing something
//
inputFind.addEventListener('input', (e) => {
    if (inputFind.value.length > 0) {
        for (let i = 1, row; row = tabRedir.rows[i]; i++) {
            row.style.display = "none";
        }
    } else {
        for (let i = 0, row; row = tabRedir.rows[i]; i++) {
            row.removeAttribute('style');
        }
    }

    for (var i = 1, row; row = tabRedir.rows[i]; i++) {
        for (var j = 0, col; col = row.cells[j]; j++) {
            if (inputFind.value.length > 1 && col.innerHTML.includes(inputFind.value)) {
                row.removeAttribute('style');
            }
        }
    }
});


//
// Add alias form : clicking generate UUID link button
//
btnUuid.addEventListener('click', (e) => {
    e.preventDefault();
    showInfobox("Generating UUID...");
    fetch('/get_uuid')
        .then(response => response.text())
        .then(text => inputAlias.value = text);
});


//
// Add alias form : clicking Create(submit) button
//
formRedir.addEventListener('submit', async (e) => {
    e.preventDefault();
    let newRedirForm = new FormData(formRedir);
    newRedirForm = JSON.stringify(Object.fromEntries(newRedirForm));
    await setRedir(newRedirForm);

    let aliasData = await getAliasList(e);
    updateTable(aliasData);
});