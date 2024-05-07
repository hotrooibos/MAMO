/*! *****************************************************************************
MAMO web view
https://github.com/hotrooibos/MAMO

Author: Antoine Marzin
Released under the MIT license
https://github.com/hotrooibos/MAMO?tab=MIT-1-ov-file

ASCII comments : https://www.patorjk.com/software/taag/#p=display&f=ANSI%20Regular
***************************************************************************** */

// General
const doc               = document;
const wrapper           = doc.querySelector('#wrapper');
const delDialog         = doc.querySelector('#dialog-del');
const synDialog         = doc.querySelector('#dialog-syn');

// Table
const redirList         = doc.querySelector('#redir-list');
const redirTabl         = doc.querySelector('#redir-tab');
const tbody             = redirTabl.querySelector('tbody');

// Table servitudes
const showHideBtn       = doc.querySelector('#show-hide');
const refreshBtn        = doc.querySelector('#refresh-redirs');
const syncBtn           = doc.querySelector('#sync-remote');
const newAliasBtn       = doc.querySelector('#new-alias');
const saveAliasBtn      = doc.querySelector('#save-alias');
const cancelAliasBtn    = doc.querySelector('#cancel-alias');
const domainSelect      = doc.querySelector('#domain-select');
const destSelect        = doc.querySelector('#dest-select');
const redirCount        = doc.querySelector('#redir-count');
const findInput         = doc.querySelector('#find');

// Global vars
let workingDomain       = domainSelect.value;
let destAddr            = destSelect.value;

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


/**
 * Convert epoch dates from <time> tags into readable date
 * 
 * Takes an optional parameter of nodes list (array) of <time> elements to convert
 * 
 * If no parameter is set, it will convert all <time> founds on page
 */
function convertEpoch(timeElements) {
    let dates;

    if (timeElements) {
        dates = timeElements;
    } else {
        dates = doc.querySelectorAll('time');
    }

    // Convert epoch integers to dd/mm/yyyy
    for (const d of dates) {
        if (d.innerText) {
            dt = parseInt(d.innerText);
            dt = new Date(dt * 1000);

            const options = {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            };

            const formatedDate = new Intl.DateTimeFormat('en-GB', options).format(dt);

            d.innerText = formatedDate;
        }
    }
}


/**
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

            if (text.split('@')[1] != workingDomain)
                console.log("Wrong domain: " + text.split('@')[1] + " != " + workingDomain)
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


/**
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

const rowTemplate = (key, name, date, alias, to) => {
    const res =
    `<tr id="${key}">
        <td data-alias-item="name">${name}</td>
        <td data-alias-item="date"><time>${date}</time></td>
        <td data-alias-item="alias">${alias}<button class="randword-btn"><i class="feather-16" data-feather="refresh-cw"></i> word</button>
            <button class="uuid-btn"><i class="feather-16" data-feather="refresh-cw"></i> UUID</button>
            <button class="clipboard-btn"><i class="feather-16" data-feather="clipboard"></i></button>
        </td>
        <td data-alias-item="to">${to}</td>
        <td data-alias-item="edit" class="text-center no-wrap">
            <button class="btn-edit"><i data-feather="edit"></i></button>
            <button class="btn-del"><i data-feather="trash-2"></i></button>
        </td>
    </tr>`;

    return res;
};

/**
 * Table
 * Update the table with JSON data in parameter
 */
function updateTable(jsonObj) {
    // let startTime = performance.now()

    let newTbodyContent = "";

    // For each alias, add row to HTML string from row template
    for (const key in jsonObj)
        newTbodyContent += rowTemplate(key,
                                       jsonObj[key]['name'],
                                       jsonObj[key]['date'],
                                       jsonObj[key]['alias'],
                                       jsonObj[key]['to']);

    // Apply the HTML string to the table body HTML
    tbody.innerHTML = newTbodyContent;

    // let endTime = performance.now()
    // console.log(`${endTime - startTime} milliseconds`)

    redirCount.innerText = Object.keys(jsonObj).length;

    // Feather icons : replace <i data-feather> with icons
    // https://github.com/feathericons/feather?tab=readme-ov-file#featherreplaceattrs
    feather.replace();

    convertEpoch();
    setActionBtns();
}


/**
 * Add a new alias row
 */
async function addRow(context) {
    const newRow = doc.createElement('tr');
    let id, name, date, alias, to;

    // Context given, insert row with context informations
    if (context.id) {
        id = context.id;
        name = context.name;
        date = context.date;
        alias = context.alias;
        to = context.to;
    }

    // No context, create generic row (new redir)
    if (!context.id) {
        const domain = workingDomain == "all" ? "domain.com" : workingDomain;
        name = "New alias";
        date = "";
        alias = await genName() + "@" + domain;
        to = destAddr;
    }

    newRow.innerHTML = rowTemplate( id,
                                    name,
                                    date,
                                    alias,
                                    to);

    tbody.insertAdjacentElement("afterbegin", newRow);

    feather.replace();

    // Affect click listeners to all the
    // buttons belonging to the row
    setActionBtns();

    // No context, set row as editable
    if (!context.id) {
        setEditable(newRow);
            
        // Enable Save / Cancel btn
        saveAliasBtn.disabled = false;
        cancelAliasBtn.disabled = false;
    }
}


/**
 * Transform the given row (<TR> element)
 * and its children to an editable
 */
function setEditable(row) {
    const tdArr = row.querySelectorAll('td');
    const uuidBtn = row.querySelector('.uuid-btn');
    const randwordBtn = row.querySelector('.randword-btn');

    row.__edit = true;
    uuidBtn.style.display = " block";
    randwordBtn.style.display = "block";

    // Make TDs editables
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
}


/**
 * Makes cells from a specific row editables
 * Called when clicking an edit row btn
 */
function editRow(e) {
    const clickedEle = e.target;
    const parentTr = clickedEle.parentElement.closest('tr');

    setEditable(parentTr);

    saveAliasBtn.disabled = false;
    cancelAliasBtn.disabled = false;
}

/**
 * Delete a row
 */
function delRow(row) {
    console.log(row);
    row.parentNode.removeChild(row);
}


/**
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


/**
 * Create/save modified aliases 
 * Called when clicking the save btn
 */
async function saveAlias(e) {
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
                        td.classList.add('input-err');
                        showInfobox("Create alias : wrong alias address format");
                        err = true;
                    }
                    continue;

                case "to":
                    isValidFormat = controlAlias(td);
                    if (isValidFormat)
                        to = td.innerText;
                    else {
                        td.classList.add('input-err');
                        showInfobox("Create alias : wrong destination address format");
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

            const aliasData = await getAliasList(e);
            updateTable(aliasData);
        }
    }
}


/**
 * Lock editable cells (td)
 */
function lockRows() {
    // Identify row/cells under edition
    const trArr = tbody.querySelectorAll('tr');

    for (const tr of trArr) {
        // Delete rows with no ID (cancelled new alias creation)
        if (!tr.id) {
            tr.remove();
            continue;
        }

        const uuidBtn = tr.querySelector('.uuid-btn');
        const randwordBtn = tr.querySelector('.randword-btn');
        uuidBtn.style.display = "none";
        randwordBtn.style.display = "none";

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


/**
 * Cancel all ongoing editions on table by
 * rolling back values to initial ones
 */
function cancelAliasOperations() {
    const editedTdArr = tbody.querySelectorAll('td[contenteditable]');

    for (const td of editedTdArr)
        if (td.__origContent)
            td.innerHTML = td.__origContent;

    lockRows();
}


/**
 * Copy alias to clipboard
 */
function aliasCopy() {
    console.log("trest");
    let parentTd = this.parentElement;
    let copyText = parentTd.childNodes[0].data;
    copyText = copyText.trim();
    navigator.clipboard.writeText(copyText);
    showInfobox(`${copyText} copied to clipboard`);
}


/**
 * Add action for tool buttons
 */
async function toolBtnAction() {
    // UUID generation for alias
    if (this.classList.contains('uuid-btn')) {
        const newAlias = crypto.randomUUID() + "@" + workingDomain;
        this.parentElement.childNodes[0].data = newAlias;

    // Random word generation for alias
    } else if (this.classList.contains('randword-btn')) {
        const newAlias = await genName() + "@" + workingDomain;

        // TODO : check if generated alias doesnt already exist, and if so, generate another
        // const aliasData = await getAliasList(workingDomain);
        // let aliasArr = [];
        // console.log(Object.entries(aliasData));

        // for (const [k, v] in Object.entries(aliasData)) {
        //     console.log(typeof(v['0']));
        // }

        this.parentElement.childNodes[0].data = newAlias;
    
    // Delete btn
    } else if (this.classList.contains('btn-del')) {
        const parentTr = this.parentElement.closest('tr');
        const id = parentTr.id;

        // If parent row has an ID, we want to delete an existing alias,
        // Else, we are just canceling/removing a new alias creation row
        if (id) {
            const alias = parentTr.querySelector('td[data-alias-item="alias"]').childNodes[0].data;
            const dialogText = `Remove alias ${alias} ?`;
            delDialog.querySelector('p').innerText = dialogText;
            // TODO using an array for future bulk deletion
            // atm, there will only be one id in the __delArr
            delDialog.__delArr = [id];
            delDialog.returnValue = 'no';
            delDialog.showModal();            
        } else {
            parentTr.remove();
        }
    }
}


/**
 * Set actions for buttons of each row
 */
function setActionBtns() {
    const clipboardBtns = doc.querySelectorAll('.clipboard-btn');
    const uuidBtns = doc.querySelectorAll('.uuid-btn');
    const randwordBtns = doc.querySelectorAll('.randword-btn');
    const delBtns = doc.querySelectorAll('.btn-del');
    const editBtns = doc.querySelectorAll('.btn-edit');

    // Copy to clipboard buttons
    for (const btn of clipboardBtns)
        btn.addEventListener('click', aliasCopy);

    // UUID gen buttons
    for (const btn of uuidBtns)
        btn.addEventListener('click', toolBtnAction);

    // Random word gen buttons
    for (const btn of randwordBtns)
        btn.addEventListener('click', toolBtnAction);

    // Delete buttons, show modal
    for (const btn of delBtns)
        btn.addEventListener('click', toolBtnAction);

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

/**
 * Backend call to create a redirection
 * 
 *  jsonObj = {
 *      "name" : name,
 *      "alias" : alias,
 *      "to" : to
 *  }
 * 
 * Returns a JSON Object {id, name, date, alias, to}
 */
async function createRedir(jsonObj) {
    showInfobox("Creating new alias " + jsonObj['alias']);

    const jsonStr = JSON.stringify(jsonObj);

    try {
        const res = await fetch('/set_redir', {
            method: 'post',
            body: jsonStr,
        });

        return res;

    } catch (error) {
        showInfobox(error);
    }
}


/**
 * Backend call to edit a redirection
 */
async function editRedir(jsonObj) {
    showInfobox("Editing alias " + jsonObj['alias']);

    const jsonStr = JSON.stringify(jsonObj);

    try {
        const res = await fetch('/edit_redir', {
            method: 'post',
            body: jsonStr,
        });

        const resText = await res.text();

        if (res.status == 200) {
            showInfobox("Alias edited succesfully !");
        } else {
            showInfobox("Edit error:\n" + resText);
        }

    } catch (error) {
        showInfobox(error);
    }
}


/**
 * Backend call to remove redirections
 * 
 * Take an array of redirection(s) ID(s) as argument
 * 
 *      example : delRedir(['123456789', '234567891']);
 * 
 * Returns status code
 */
async function delRedir(array) {
    try {
        const res = await fetch('/del_redir', {
            method: 'post',
            body: array,
        });

        return res;

    } catch (error) {
        showInfobox(error);
    }
}


/**
 * Backend call to get a string alias list
 * return it as a JSON object (dict)
 */
async function getAliasList(e, domain=workingDomain) {
    const ele = e.target;

    const res = await fetch('/get_redirs', {
        method: 'post',
        body: JSON.stringify(domain),
    });

    if (res.status == 200) {
        const resText = await res.text();
        return JSON.parse(resText);
    }
}


/**
 * Check both local config and remote redirs,
 * and return two lists :
 *  - list of local entries unknown from remote
 *  - list of remote entries unknown from local
 */
async function synCheck(e, domain=workingDomain) {
    const synForm = synDialog.querySelector('form');

    // Show modal window
    let ele = doc.createElement('p');
    ele.innerText = "Loading...";
    synForm.append(ele);

    synDialog.returnValue = null;
    synDialog.showModal();

    // Start sync
    const res = await fetch('/syn_check', {
        method: 'post',
        body: JSON.stringify(domain),
    });

    let resText = await res.text();
    resText = JSON.parse(resText);

    if (res.status == 200) {
        let addBtn;
        // Remote alias count
        ele.innerText = "Alias count in remote : " + resText[0];

        // List of aliases unknown from remote
        if (resText[1].length > 0) {
            ele = doc.createElement('h2');
            ele.innerText = "Alias unknown from remote :"
            synForm.append(ele);
            
            for (const i of resText[1]) {
                ele = doc.createElement('p');
                ele.innerText = i;
                synForm.append(ele);

                addBtn = doc.createElement('button');
                addBtn.name = "create-alias";
                addBtn.value = i;
                addBtn.innerText = "Create alias";
                addBtn.addEventListener('click', synAddAlias);
                ele.append(addBtn);

                addBtn = doc.createElement('button');
                addBtn.name = "delete-row";
                addBtn.value = i;
                addBtn.innerText = "Delete";
                addBtn.addEventListener('click', synDelAlias);
                ele.append(addBtn);
            }
        }

        // List of aliases unknown from local alias config
        if (resText[2].length > 0) {
            ele = doc.createElement('h2');
            ele.innerText = "Alias unknown locally :";
            synForm.append(ele);

            for (const [k, v] of resText[2].entries()) {
                ele = doc.createElement('p');
                ele.innerText = v;
                synForm.append(ele);

                addBtn = doc.createElement('button');
                addBtn.innerText = "Add";
                addBtn.name = "remote-alias-id";
                addBtn.value = resText[2][k][0];
                addBtn.addEventListener('click', synAddAlias);
                ele.append(addBtn);
            }
        }

        ele = doc.createElement('button');
        ele.value = "cancel"
        ele.autofocus = true;
        ele.setAttribute("formmethod", "dialog");
        ele.innerText = "Cancel";
        synForm.append(ele);
        
    } else {
        showInfobox("Error:\n" + resText);
    }
}


/**
 * Synchronisation : add alias
 */
async function synAddAlias() {
    switch (this.name) {

        // Create "locally known" alias in remote
        // The alias doesn't really exists yet,
        // so this actually creates the alias
        case "create-alias":
            const value = this.value.split(',');
            const name = "Alias created from sync";
            const oldId = value[0];
            const alias = value[1];
            const to = value[2];

            // Create the redirection
            newRedir = {
                "name" : name,
                "alias" : alias,
                "to" : to
            }
            const res = await createRedir(newRedir);
            let resText = await res.text();
            resText = JSON.parse(resText);

            if (res.status == 200) {
                // TODO update the row id and date
                const tr = doc.querySelector(`tr[id="${oldId}"]`);    
                const date = tr.querySelectorAll('time');
                tr.id = resText['id'];

                if (date[0].innerText == "") {
                    date[0].innerText = resText['date'];
                    convertEpoch(date);
                }
                
                showInfobox("Sync : alias created succesfully");
            } else {
                showInfobox("Sync : create error:\n" + resText);
            }

            break;
        
        // Create "remotely known" alias in local
        // The alias already exists and works,
        // so this just makes the app know the alias
        case "remote-alias-id":
            alert('Add exiting alias localy : ' + this);
            console.log(this);
            break;
    
        default:
            break;
    }
}


/**
 * Synchronisation : add alias
 */
async function synDelAlias() {
    switch (this.name) {

        // Remove local entry/row
        case "delete-row":
            const value = this.value.split(',');
            const id = value[0];
            const delIdArr = JSON.stringify([id]);
            const res = await delRedir(delIdArr);

            if (res.status == 200) {
                showInfobox("Local entry " + value[1] + " removed");

                // Remove row from table
                for (const tr of tbody.querySelectorAll('tr')) {
                    if (tr.id == id) {
                        tr.remove();
                        this.parentElement.remove();
                    }
                }
            } else {
                showInfobox("An error occured while removing local entry :\n" + await res.text());
            }
            break;
    
        default:
            break;
    }
}


/**
 * Generate a random word from adjectives + nouns dictionnaries
 */
async function genName() {
    const res = await fetch('/gen_name', {
        method: 'post'
    });

    if (res.status == 200) {
        const resText = await res.text();
        return resText;
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

/**
 * Table : show/hide button
 */
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


/**
 * Table : New alias link button
 */
newAliasBtn.addEventListener('click', addRow);


/**
 * Save button : save new/edit alias operations made in table
 */
saveAliasBtn.addEventListener('click', saveAlias);


/**
 * Cancel button : cancel all "new" and/or "edit" alias operations in table
 */
cancelAliasBtn.addEventListener('click', (e) => {
    cancelAliasOperations();
    lockRows();
    saveAliasBtn.disabled = true;
    cancelAliasBtn.disabled = true;
});


/**
 * Domain select : change working domain
 * Update localstorage to remember current selection,
 * and update the table to show redirections
 * for selected domain only
 */
domainSelect.addEventListener('change', async (e) => {
    workingDomain = domainSelect.value;
    localStorage.setItem('workingDomain', workingDomain);

    const aliasData = await getAliasList(e, workingDomain);
    updateTable(aliasData);
});


/**
 * Destination address select : change default destination address
 * Update localstorage to remember current selection,
 */
destSelect.addEventListener('change', async (e) => {
    destAddr = destSelect.value;
    localStorage.setItem('destAddr', destAddr);
});


/**
 * Table refresh link button
 */
refreshBtn.addEventListener('click', async (e) => {
    const aliasData = await getAliasList(e, workingDomain);
    updateTable(aliasData);
});


/*
 * Sync remote button
 */
syncBtn.addEventListener('click', synCheck);


/**
 * Delete dialog box
 */
delDialog.addEventListener('close', async (e) => {
    if (delDialog.returnValue === "yes") {
        const delIdArr = JSON.stringify(delDialog.__delArr);

        // Remove alias
        res = await delRedir(delIdArr);

        const resText = await res.text();

        if (res.status == 200) {
            showInfobox("Alias removed succesfully");

            // Remove row from table
            for (const tr of tbody.querySelectorAll('tr'))
                if (delIdArr.includes(tr.id))
                    tr.remove();
        } else {
            showInfobox("Remove error :\n" + resText);
        }
    }
});


/**
 * Sync dialog box
 */
synDialog.addEventListener('close', (e) => {
    synDialog.querySelector('form').innerHTML = "";
});


/**
 * Find/search in table input : typing something
 */
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
                col.innerText.toLowerCase().includes(findInput.value.toLowerCase())) {
                row.style.display = "";
                cntFiltered = tbody.querySelectorAll('tr[style="display: none;"]').length;
                redirCount.innerText = cnt - cntFiltered;
            }
        }
    }
});


/**
 * Add alias form : clicking generate UUID link button
 */
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


/**
 * On page load :
 *  - get last user parameters from local storage
 *  - fetch all locally known aliases and build table
 */
window.addEventListener('load', async (e) => {
    if (localStorage.getItem('workingDomain')) {
        workingDomain = localStorage.getItem('workingDomain');
        domainSelect.value = workingDomain;
    }

    if (localStorage.getItem('destAddr')) {
        destAddr = localStorage.getItem('destAddr');
        destSelect.value = destAddr;
    }
    
    const aliasData = await getAliasList(e, workingDomain);
    updateTable(aliasData);
});