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

const delDialog         = doc.querySelector('#dialog-del');

let selDomain           = "tical.fr";



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
 * CONVERT epoch dates from <time> tags into readable date
 */
function convertEpoch() {
    const dates = doc.querySelectorAll('time');

    for (const d of dates) {
        if (d.innerText) {
            dt = parseInt(d.innerText);
            dt = new Date(dt * 1000);

            const options = {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            };

            // GB time format (ex: 28 September 2022)
            const formatedDate = new Intl.DateTimeFormat('en-GB', options).format(dt);

            d.innerText = formatedDate;
        }
    }
}


/*
 * Control that an alias (with attributes name, alias, to)
 * format is valid (no linebreak, e-mail format...)
 */
function controlAlias(td) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    let text;

    switch (td.dataset.aliasItem) {
        case "name":
            text = td.innerText;
            break;
        case "alias":
            // Since we have a button (uuid gen) inside <td>
            text = td.childNodes[0].data;
            break;
        case "to":
            text = td.innerText;
            break;
        default:
            break;
    }

    // Clear line breaks
    text = text.replace(/(\r\n|\n|\r)/gm, "");

    // Return true if text matches the email format regex
    return re.test(text);

}


/*
 * Disable use of Enter key to prevent line break
 */
function disableEnterKey(e) {
    if (e.keyCode === 13)
        e.preventDefault();
}


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
            "<td data-alias-item=\"date\"><time>" + jsonObj[key]['date'] + "</time></td>" +
            "<td data-alias-item=\"alias\">" + jsonObj[key]['alias'] + "<button class=\"uuid-btn\">UUID</button></td>" +
            "<td data-alias-item=\"to\">" + jsonObj[key]['to'] + "</td>" +
            "<td data-alias-item=\"edit\" class=\"text-center no-wrap\"><button class=\"btn-edit\" href=\"\"><i data-feather=\"edit\"></button></i><button class=\"btn-del\" href=\"\"><i data-feather=\"trash-2\"></button></i></td>" +
            "</tr>"
    }

    tbody.innerHTML = newTbodyContent;
    redirCount.innerText = Object.keys(jsonObj).length;

    // Feather icons : replace <i data-feather> with icons
    // https://github.com/feathericons/feather?tab=readme-ov-file#featherreplaceattrs
    feather.replace();

    convertEpoch();
    setActionBtns();
}


/*
 * Add a new alias row
 */
function addRow(e) {
    // Create a new row (tr) node from a cloned one
    // so we get its classes, datasets...
    const newRow = tbody.children[0].cloneNode(true);
    const uuidBtn = newRow.querySelector('.uuid-btn');
    
    newRow.removeAttribute('id');
    newRow.__edit = true;
    uuidBtn.style.visibility = "visible";


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
                td.__origContent = td.innerHTML;

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
 * Table sort
 */
function sortTable(n) {
    let rows,
        i = 0,
        x = "",
        y = "",
        count = 0;
    let switching = true;
    let shouldSwitch;

    // Order is set as ascending
    let direction = 'ascending';

    // Run loop until no switching is needed
    while (switching) {
        switching = false;
        rows = tbody.rows;

        //Loop to go through all rows
        for (i = 0; i < rows.length - 1; i++) {
            shouldSwitch = false;

            // Fetch 2 elements that need to be compared
            x = rows[i].getElementsByTagName('TD')[n];
            y = rows[i + 1].getElementsByTagName('TD')[n];

            // Check the direction of order
            if (direction == 'ascending') {
                // Check if 2 rows need to be switched
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                    // If yes, mark Switch as needed and break loop
                    shouldSwitch = true;
                    break;
                }
            } else if (direction == 'descending') {
                // Check direction
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                    // If yes, mark Switch as needed and break loop
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            // Function to switch rows and mark switch as completed
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;

            // Increase count for each switch
            count++;
        } else {
            // Run while loop again for descending order
            if (count == 0 && direction == 'ascending') {
                direction = 'descending';
                switching = true;
            }
        }
    }
}


/*
 * Create/save modified aliases 
 * Called when clicking the save btn
 */
function saveAlias() {
    const trArr = tbody.querySelectorAll('tr');
    const editTrArr = [];
    let newRedir;
    let name;
    let alias;
    let to;
    let isValidFormat = true;
    let err = false;

    // Make array of edited modified rows
    for (const tr of trArr)
        if (tr.__edit)
            editTrArr.push(tr);

    // Loop through modified rows
    // - Check format validity for each edited cell
    // - Process creation/edition if ok
    for (const tr of editTrArr) {
        // Format validation
        for (const td of tr.children) {    
            switch (td.dataset.aliasItem) {
                case "name":
                    controlAlias(td);
                    name = td.innerText;
                    continue;

                case "alias":
                    isValidFormat = controlAlias(td);
                    if (isValidFormat)
                        alias = td.childNodes[0].data;
                    else {
                        console.log("Create: " + td.dataset.aliasItem + " format err")
                        err = true;
                    }
                    continue;

                case "to":
                    isValidFormat = controlAlias(td);
                    if (isValidFormat)
                        to = td.innerText;
                    else {
                        console.log("Create: " + td.dataset.aliasItem + " format err")
                        err = true;
                    }
                    continue;

                default:
                    break;
            }
        }

        // Create/edit
        if (!err) {
            newRedir = {
                "id" : tr.id,
                "name" : name,
                "alias" : alias,
                "to" : to
            }

            // Creation : new alias (row has no id)
            if (!tr.id) {
                delete newRedir['id'];
                createRedir(newRedir);
            }

            // Edition : alias with __edit property
            else if (tr.__edit)
                editRedir(newRedir);
        }
    }
}


/*
 * Lock editable cells (td)
 */
function lockRows() {
    // Identify row/cells under edition
    const trArr = tbody.querySelectorAll('tr');

    for (const tr of trArr) {

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
}


/*
 * Cancel all ongoing editions on table by
 * rolling back values to initial ones
 */
function cancelAliasOperations() {
    const editedTdArr = tbody.querySelectorAll('td[contenteditable]');

    for (const td of editedTdArr) {
        if (td.__origContent)
            td.innerHTML = td.__origContent;
        else
            td.innerHTML = "";
    }
}


function setActionBtns() {
    const uuidBtns = doc.querySelectorAll('.uuid-btn');
    const delBtns = doc.querySelectorAll('.btn-del');
    const editBtns = doc.querySelectorAll('.btn-edit');

    // UUID gen buttons
    for (const btn of uuidBtns) {
        btn.addEventListener('click', () => {
            let newAlias = crypto.randomUUID() + "@" + selDomain;
            btn.parentElement.childNodes[0].data = newAlias;
        });
    }

    // Delete buttons
    for (const btn of delBtns) {
        btn.addEventListener('click', () => {
            const parent = btn.parentElement.closest('tr');
            const id = parent.id;
            const alias = parent.querySelector('td[data-alias-item="alias"]').childNodes[0].data;
            const dialogText = "Remove alias " + alias + " ?";
            delDialog.querySelector('p').innerHTML = dialogText;
            delDialog.__delArr = [id];
            delDialog.showModal();
        })
    }

    // Edit buttons
    for (const btn of editBtns)
        btn.addEventListener('click', editRow);
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
            row.style.display = "";
            redirCount.innerText = cnt;
        }
    }

    // ... and show the ones containing typed text
    for (let i = 0, row; row = tbody.rows[i]; i++) {
        for (let j = 0, col; col = row.cells[j]; j++) {
            if (findInput.value.length > 0 &&
                col.innerText.includes(findInput.value)) {
                row.style.display = "";
                cntFiltered = tbody.querySelectorAll('tr[style="display: none;"]').length;
                redirCount.innerText = cnt - cntFiltered;
            }
        }
    }
});


//
// Add alias form : clicking generate UUID link button
//
const testBtn = doc.querySelector('#test-btn');
testBtn.addEventListener('click', (e) => {
    // const delBtns = doc.querySelectorAll('.btn-del');
    // const editBtns = doc.querySelectorAll('.btn-edit');
    // for (const btn of delBtns)
    //     btn.disabled = true;
    // for (const btn of editBtns)
    //     btn.disabled = true;

    const editedCells = tbody.querySelectorAll('td[contenteditable="true"]');
    let editRow;
    for (const td of editedCells) {
        editRow = td.parentElement.querySelector('td[data-alias-item="edit"]');
        editRow.innerHTML = '<div class="dot-flashing"></div>';

        td.setAttribute('style', 'color: var(--color-text-gray-1);');
    }

});


convertEpoch();