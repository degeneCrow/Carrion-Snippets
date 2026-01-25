let currentTemplate
let manifest = []
let cardTemplate
let editorForm


const DOMPURIFY_OPTS = {ADD_TAGS: ['link'], FORCE_BODY: true}
const SHADOW_DOM = document.getElementById('character-description')
    .attachShadow({ mode: "open" });


// Make sure link tags are safe
DOMPurify.addHook('uponSanitizeElement', function(node, data) {
  switch (node.tagName) {
    case 'LINK': 
      node.setAttribute('rel', 'stylesheet')
      break
    default:
      break
  }
});

function removeIndent(input) { return input.split('\n').map(line => line.trim()).join('\n') }


async function fetchJson(url) {
  const response = await fetch(url);
  return await response.json()
}


async function fetchTemplate(template) {
  const response = await fetch(template)
  return Handlebars.compile(await response.text())
}

// Ui Generator, called recursively for lists.
function buildTemplateConfigurator(options, targetNode, idPrefix = "") { 

  for (const [optionID, parameters] of Object.entries(options)) {

    const container = document.createElement('li')
    container.appendChild(Object.assign(document.createElement('label'), {
      innerHTML: parameters.label ?? optionID
    }))

    switch (parameters.type) {
      case 'list':
        const nestedContainer = document.createElement('ul')
        nestedContainer.id = idPrefix + optionID
        nestedContainer.dataset.nextIndex = 0;

        // List controls created here
        const controls = Object.assign(document.createElement('div'), {
          className: 'list-controls'
        })
        controls.appendChild(Object.assign(document.createElement('button'), {
          textContent: '-',
          className: 'btn btn-secondary',
          onclick: (e) => { e.target.parentElement.previousElementSibling.lastElementChild?.remove() }
        }))
        controls.appendChild(Object.assign(document.createElement('button'), {
          textContent: '+',
          className: 'btn btn-secondary',
          onclick: (e) => { addListItem(e.target.parentElement.previousElementSibling) }
        }))

        nestedContainer.dataset.template = JSON.stringify(parameters.template) 

        // Create the list items registered within the manifest
        for (const item of parameters.items) { addListItem(nestedContainer, item) }
        container.appendChild(nestedContainer)

        // Only show add / remove if the template author intends it to be editable
        if (parameters.editable ?? true) { container.appendChild(controls) }

        break

      case 'textarea':
        container.appendChild(Object.assign(document.createElement('textarea'), {
          innerHTML: parameters.value,
          name: `${idPrefix}.${optionID}`
        })) 
        break
      default: 
        container.appendChild(Object.assign(document.createElement('input'), {
          ...parameters,
          name: `${idPrefix}.${optionID}`
        }))
        break
    }

    targetNode.appendChild(container)
  }
}


function getFormData(form) {
  const formData = new FormData(form)
  const data = {}

  // Do some black magic reduce bullshit that I already forgot how it works to filter the form back into a list.
  formData.forEach((value, key) => {
    const cleanedKey = key.startsWith('.') ? key.substring(1) : key
    const keys = cleanedKey.split('.')

    keys.reduce((acc, part, index) => {
      if (index === keys.length - 1) { 
        acc[part] = value 
      } else { 
        acc[part] = acc[part] || (isNaN(keys[index + 1]) ? {} : [])
      }
      return acc[part]
    }, data);
  });
  return data
}


function handleFormSubmit(event) {
  event.preventDefault() 
  updatePreview(getFormData(this))
}

// Update the shadow dom preview
function updatePreview(data) {
  SHADOW_DOM.innerHTML = '';

  const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'lib/shadow.css';

  const wrap = document.createElement('div');
  wrap.className = 'shadow-content';
  wrap.innerHTML = DOMPurify.sanitize(marked.parse(removeIndent(currentTemplate(data))), DOMPURIFY_OPTS);

  SHADOW_DOM.appendChild(link);
  SHADOW_DOM.appendChild(wrap);
}

// Sets the current template from it's manifest index
async function setActiveTemplate(index) {
  const info = manifest[index]
  const metadata = await fetchJson(info.metadata)
  currentTemplate = await fetchTemplate(metadata.template)
  const editor = document.getElementById('editor-container')

  editor.innerHTML = ""
  previewDiv = buildTemplateConfigurator(metadata.options, editor)
  updatePreview(getFormData(editorForm))
}

// Copy the template to the clipboard
function copyTemplate() {
  const template = SHADOW_DOM.querySelector('.shadow-content').innerHTML;

  navigator.clipboard.writeText(template)
    .then(() => alert(`
Output copied!
Now you can paste it into your character description!
    `))
    .catch(err => console.error("Copy failed:", err));
}

// Wait until DOM is loaded to start manipulating shit. Also lets us use async code in here.
document.addEventListener("DOMContentLoaded", async function() {
  editorForm = document.getElementById('editor-form')
  manifest = await fetchJson('templates/manifest.json')
  cardTemplate = await fetchTemplate('assets/templates/card.hbs')
  document.getElementById('editor-form')
    .addEventListener('submit', handleFormSubmit)

  const tempDiv = document.createElement('div')
  const container = document.getElementById('template-control')
  for (const [index, item] of manifest.entries()) {
    // we're creating the card with the template here
    tempDiv.innerHTML = cardTemplate({index, ...item})
    tempDiv.firstChild.onclick = (e) => { setActiveTemplate(index) }
    // we're shoving the card within ALL of its appropriate categories here
    let template_categories = item.categories ?? ['default']
    for (const category of template_categories) {
      // first of course create the tab, if one does not exist
      let tabContainer = findCreateTemplateCategoryTab(container, category)
      tabContainer.appendChild(tempDiv.firstChild)
    }
  }
})

function findCreateTemplateCategoryTab(container, category) {
  let tabContainer = container.querySelector(`.tab.cat-${category}`)
  if (! tabContainer) {
    // have to make it
    tabContainer = document.createElement('div')
    tabContainer.className = `tab cat-${category}`
    container.querySelector('#template-list-container').appendChild(tabContainer)
    // don't forget the inputs & tab labels
    
  }
  return tabContainer
}

// Add click events to UI buttons
document.getElementById('copy-html-button')
  .addEventListener("click", copyTemplate);
document.getElementById('refresh-display-button')
  .addEventListener("click", () => { updatePreview(getFormData(editorForm)) });


// List item management
function addListItem(list, values = {}) { 

  const itemId = `${list.id}.${list.dataset.nextIndex}`
  
  const newCont = document.createElement('li')
  newCont.appendChild(Object.assign(document.createElement('label'), {
    innerHTML: list.dataset.nextIndex
  }))
  const newItem = document.createElement('ul')

  const template = JSON.parse(list.dataset.template)

  // Fill with new values if provided
  for (const [key, value] of Object.entries(values)) {
    template[key].value = value;
  }

  buildTemplateConfigurator(template, newItem, itemId)
  
  //update DOM
  list.dataset.nextIndex = Number(list.dataset.nextIndex) + 1
  newCont.append(newItem)
  list.append(newCont)
  fixListIndexes(list)
}


function fixListIndexes(list) {
  /*
    Only fixes the displayed IDs, as actual indexes in the ids do not matter in any way shape or form since templates can skip empty indexes.
    Also, fixing the IDs here would require a huge recursive check, so if we REALLY care, it would be better to just do it once before passing to template.

    Also, I'm lazy. - Kayla
  */
  for (const [i, child] of Object.entries(list.childNodes)) {
    child.firstElementChild.textContent = i
  }

}
