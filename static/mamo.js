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

const showHide      = doc.querySelector('#showHide');
const findInput     = doc.querySelector('#find');
const redirList     = doc.querySelector('#redir-list');
const redirTab      = doc.querySelector('#redir-tab');
const btnsDel       = doc.querySelectorAll('.btn-del');
const btnsEdit      = doc.querySelectorAll('.btn-edit');

const redirForm     = doc.querySelector('#redir_form');
const genUuid       = doc.querySelector('#gen_uuid');
const fieldAlias    = doc.querySelector('#alias');

const delForm       = doc.querySelector('#del_redir_form');
const fieldAliasDel = doc.querySelector('#id_del');

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
    }, 5000);
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
        if (dt.getFullYear() != new Date().getFullYear() ) {
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

    fetch('/del_redir', {
        method: 'post',
        body: form,
    })
    .then(response => response.status)  
    .then(status => {
        if (status == 200) {
            showInfobox("Alias removed succesfully !");
        } else {
            showInfobox("An error occured while removing the alias...");
        }
    });
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
            tdItem.removeAttribute('contenteditable','');
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
            tdItem.removeAttribute('contenteditable','');
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
showHide.addEventListener('click', (e) => {
    // getRedirs();

    if (redirList.hasAttribute('class')) {
        redirList.removeAttribute('class');
        redirList.style.height = '100%';
    }
    else {
        redirList.setAttribute('class', 'fade-bottom');
        redirList.removeAttribute('style');
    }
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
dialogDel.addEventListener('close', (e) => {
    if (dialogDel.returnValue === "yes") {
        let delArr = JSON.stringify(dialogDel.__delArr);
        delRedir(delArr);
    }
});


//
// Find/search in table input : typing something
//
findInput.addEventListener('input', (e) => {
    if (findInput.value.length > 0) {
        for (let i = 1, row; row = redirTab.rows[i]; i++) {
            row.style.display = "none";
        }
    } else {
        for (let i = 0, row; row = redirTab.rows[i]; i++) {
            row.removeAttribute('style');
        }
    }

    for (var i = 1, row; row = redirTab.rows[i]; i++) {
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
genUuid.addEventListener('click', (e) => {
    e.preventDefault();
    showInfobox("Generating UUID...");
    fetch('/get_uuid')
    .then(response => response.text())  
    .then(text => fieldAlias.value = text);
});


//
// Add alias form : clicking Create(submit) button
//
redirForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let newRedirForm = new FormData(redirForm);
    newRedirForm = JSON.stringify(Object.fromEntries(newRedirForm));
    setRedir(newRedirForm);
});