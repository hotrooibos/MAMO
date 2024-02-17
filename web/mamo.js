const doc       = document;

const listRedir = doc.querySelector('#listRedir');
const redirList = doc.querySelector('#redirList');

const listTest = doc.querySelector('#listTest');
const testList = doc.querySelector('#testList');


function showRedirs(jsonStr) {
    jsonObj = JSON.parse(jsonStr);

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

function getRedirs() {
    eel.get_redirs()(showRedirs);
}

listRedir.addEventListener('click', (e) => {
    getRedirs();
});


// Tests
var testDict = {
    "001": {
        "name": "Test",
        "date": "",
        "alias": "001@tical.fr",
        "to": "antoine@marzin.org"
    },
    "002": {
        "name": "",
        "date": "",
        "alias": "002@tical.fr",
        "to": "antoine@marzin.org"
    }
}

listTest.addEventListener('click', (e) => {
    console.log('Type : ' + typeof(testDict));

    for (const key of Object.keys(testDict)) { 
        console.log(key + ": " + JSON.stringify(testDict[key])); 
     };
});