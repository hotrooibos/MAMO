/*
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
const redirCount        = doc.querySelector('#redir-count')
const findInput         = doc.querySelector('#find');
const redirList         = doc.querySelector('#redir-list');
const redirTabl         = doc.querySelector('#redir-tab');
const tbody             = redirTabl.querySelector('tbody');

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
    const boxesArr = doc.querySelectorAll('.msgbox');

    // Move down msg boxes actually displayed
    for (let i = 0; i < boxesArr.length; i++) {
        const box = boxesArr[i];
        box.style.top = (parseFloat(box.style.top) + 4) + "em";
    }

    // Create the new box on the top
    const newBox = doc.createElement('div');
    newBox.setAttribute('id', 'msgbox');
    newBox.setAttribute('class', 'msgbox');
    newBox.innerText = msg;
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
        const formatedDate = new Intl.DateTimeFormat('en-GB', options).format(dt);

        d.innerHTML = formatedDate;
    }
}


/*
 * Table
 * Disable use of Enter key to prevent line break
 */
function disableEnterKey(e) {
    if (e.keyCode === 13)
        e.preventDefault();
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
            td.innerText = td.__origContent;
        } else {
            td.innerText = "";
        }
}


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


/*
 *
 * ████████  █████  ██████  ██      ███████ 
 *    ██    ██   ██ ██   ██ ██      ██      
 *    ██    ███████ ██████  ██      █████   
 *    ██    ██   ██ ██   ██ ██      ██      
 *    ██    ██   ██ ██████  ███████ ███████ 
 *
 */


/*
 * Table
 * Update the table with JSON data in parameter
 */
function updateTable(jsonObj) {
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
    redirCount.innerText = Object.keys(jsonObj).length;

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
    const newRow = tbody.children[0].cloneNode(true);

    newRow.removeAttribute('id');
    newRow.__edit = true;

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

    saveAliasBtn.disabled = false;
    cancelAliasBtn.disabled = false;
}


/*
 * Table
 * Makes cells from a specific row editables
 * Called when clicking an edit row btn
 */
function editRow(e) {
    e.preventDefault();
    const clickedEle = e.target;
    const parentTr = clickedEle.parentElement.closest('tr');
    const tdArr = parentTr.querySelectorAll('td');

    parentTr.__edit = true;

    // Get data to be edited and
    // make useful cells' (<td>) content editable
    for (const td of tdArr) {
        switch (td.dataset.aliasItem) {
            case "name":
            case "alias":
            case "to":
                td.contentEditable = true;
                td.classList.add('td-editable');
                td.__origContent = td.innerText;

                // And Enter key press listener to prevent line breaks
                td.addEventListener('keydown', disableEnterKey, false);
                break;
            default:
                break;
        }
    }

    saveAliasBtn.disabled = false;
    cancelAliasBtn.disabled = false;
}


/*
 * Create/save modified aliases 
 * Called when clicking the save btn
 */
function saveAlias() {
    const trArr = tbody.querySelectorAll('tr');
    const editTrArr = [];
    let newRedir;

    // Make array of edited modified rows
    for (const tr of trArr) {
        if (tr.__edit) {
            editTrArr.push('tr');
        }
    }

    // Loop through modified rows
    // and process new aliases and edited ones
    for (const tr of trArr) {

        // New aliases (row has no id)
        if (!tr.id) {
            newRedir = {};

            for (const td of tr.children) {    
                switch (td.dataset.aliasItem) {
                    case "name":
                        newRedir.name = td.innerText;
                    case "alias":
                        newRedir.alias = td.innerText;
                    case "to":
                        newRedir.to = td.innerText;
                    default:
                        break;
                }
            }

            createRedir(newRedir);
        }

        // Edited aliases
        else if (tr.__edit) {
            newRedir = {
                "id" : tr.id,
                "name" : tr.querySelector('td[data-alias-item="name"]').innerText,
                "alias" : tr.querySelector('td[data-alias-item="alias"]').innerText,
                "to" : tr.querySelector('td[data-alias-item="to"]').innerText
            }

            editRedir(newRedir);
        }
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
        if (tr.__edit) {
            delete tr.__edit;
            for (const td of tr.children) {
                td.contentEditable = false;
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


        // // Remove the table edition
        // delete editedTr.__edit;

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
    for (const btn of editBtns) {
        btn.addEventListener('click', editRow);
    }
}


/*
 *
 * ███████ ███████ ████████  ██████ ██   ██ ███████ ███████ 
 * ██      ██         ██    ██      ██   ██ ██      ██      
 * █████   █████      ██    ██      ███████ █████   ███████ 
 * ██      ██         ██    ██      ██   ██ ██           ██ 
 * ██      ███████    ██     ██████ ██   ██ ███████ ███████ 
 * 
 */

/*
 * Backend call to create a redirection
 */
async function createRedir(jsonObj) {
    showInfobox("Creating new redir " + jsonObj['alias']);

    const jsonStr = JSON.stringify(jsonObj);

    const res = await fetch('/set_redir', {
        method: 'post',
        body: jsonStr,
    })

    if (res.status == 200) {
        showInfobox("Alias created succesfully !");
    } else {
        showInfobox("An error occured while creating the alias...");
    }
}


/*
 * Backend call to edit a redirection
 */
async function editRedir(jsonObj) {
    const jsonStr = JSON.stringify(jsonObj);

    const res = await fetch('/edit_redir', {
        method: 'post',
        body: jsonStr,
    })

    if (res.status == 200) {
        showInfobox("Alias modified succesfully !");
    } else {
        showInfobox("An error occured while creating the alias...");
    }
}


/*
 * Backend call to remove a redirection
 */
async function delRedir(form) {
    showInfobox("Removing a redir...");

    try {
        const res = await fetch('/del_redir', {
            method: 'post',
            body: form,
        });

        const resText = await res.text();

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
 * Backend call to get a string alias list
 * return it as a JSON object (dict)
 */
async function getAliasList(e) {
    const ele = e.target;
    let sortKey;

    if (ele.dataset.aliasItem) {
        sortKey = ele.dataset.aliasItem;
    }

    const res = await fetch('/get_redirs', {
        method: 'post',
        body: sortKey,
    });

    if (res.status == 200) {
        const resText = await res.text();

        return JSON.parse(resText);
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
// Table : show/hide button
//
showHideBtn.addEventListener('click', (e) => {
    if (redirList.classList.contains('fade-bottom')) {
        redirList.classList.remove('fade-bottom');
        redirList.style.height = '100%';
        showHideBtn.children[0].dataset.feather = "eye-off";
    }
    else {
        redirList.classList.add('fade-bottom');
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
// Save button : save new/edit alias operations made in table
//
saveAliasBtn.addEventListener('click', async (e) => {
    saveAlias();
    const aliasData = await getAliasList(e);
    updateTable(aliasData);
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
        const delArr = JSON.stringify(delDialog.__delArr);
        await delRedir(delArr);

        const aliasData = await getAliasList(e);
        updateTable(aliasData);
    }
});


//
// Find/search in table input : typing something
//
findInput.addEventListener('input', () => {
    const cnt = tbody.querySelectorAll('tr').length;
    let cntFiltered = cnt;

    // Hide all table's rows as user types...
    if (findInput.value.length > 0) {
        for (let i = 0, row; row = tbody.rows[i]; i++) {
            row.style.display = "none";
        }
    } else {
        for (let i = 0, row; row = tbody.rows[i]; i++) {
            row.removeAttribute('style');
            redirCount.innerText = cnt;
        }
    }

    // ... and show the ones containing typed text
    for (let i = 0, row; row = tbody.rows[i]; i++) {
        for (let j = 0, col; col = row.cells[j]; j++) {
            if (findInput.value.length > 0 &&
                col.innerText.includes(findInput.value)) {
                row.removeAttribute('style');
                cntFiltered = tbody.querySelectorAll('tr[style="display: none;"]').length;
                redirCount.innerText = cnt - cntFiltered;
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
    newRedirForm = Object.fromEntries(newRedirForm);
    await createRedir(newRedirForm);

    let aliasData = await getAliasList(e);
    updateTable(aliasData);
});


convertEpoch(dates);