const doc       = document;

const listRedir = doc.querySelector('#listRedir');
const redirList = doc.querySelector('#redirList');

const redirForm = doc.querySelector('#redir_form');
const genUUID = doc.querySelector('#genUUID');
const fieldAlias = doc.querySelector('#alias');

const listTest = doc.querySelector('#listTest');
const testList = doc.querySelector('#testList');


function showRedirs(jsonStr) {
    jsonObj = JSON.parse(jsonStr);

    redirList.innerHTML = "";

    r = [];

    for (const key of Object.keys(jsonObj)) { 
        // console.log(key + ": " + JSON.stringify(jsonObj[key]));
        r.push(key + ": " + JSON.stringify(jsonObj[key]));
    };

    for (const item of r) {
        let li = doc.createElement('li');
        li.innerHTML = item;
        redirList.appendChild(li);
    }
}

function fillAlias(aliasStr) {
    // texte du field "alias" = aliasStr
    fieldAlias.value = aliasStr;
}

function getRedirs() { eel.get_redirs()(showRedirs); }
function setRedir(form) { eel.set_redir(form)(showRedirs); }
function generateUUID() { eel.get_uuid()(fillAlias); }


/*

Event listeners

*/

listRedir.addEventListener('click', (e) => {
    getRedirs();

    if (redirList.hasAttribute('style')) {
        redirList.removeAttribute('style');
    }
    else {
        redirList.style.display = 'none';
    }
});

genUUID.addEventListener('click', (e) => {
    generateUUID();
});

redirForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let newRedirForm = new FormData(redirForm);
    newRedirForm = JSON.stringify(Object.fromEntries(newRedirForm));
    setRedir(newRedirForm);
});



// // Tests
// var testDict = {
//     "001": {
//         "name": "Test",
//         "date": "",
//         "alias": "001@tical.fr",
//         "to": "antoine@marzin.org"
//     },
//     "002": {
//         "name": "",
//         "date": "",
//         "alias": "002@tical.fr",
//         "to": "antoine@marzin.org"
//     }
// }

// listTest.addEventListener('click', (e) => {
//     console.log('Type : ' + typeof(testDict));

//     for (const key of Object.keys(testDict)) { 
//         console.log(key + ": " + JSON.stringify(testDict[key])); 
//      };
// });