let currentTemplate
let manifest = []
let cardTemplate

const DOMPURIFY_OPTS = {ADD_TAGS: ['link'], FORCE_BODY: true}
const SHADOW_DOM = document.getElementById('result-preview-container')
    .attachShadow({ mode: "open" });

DOMPurify.addHook('uponSanitizeElement', function(node, data) {
  switch (node.tagName) {
    case 'LINK': 
      node.setAttribute('rel', 'stylesheet')
      break
    default:
      break
  }
});

async function fetchJson(url) {
  const response = await fetch(url);
  return await response.json()
}
async function fetchTemplate(template) {
  const response = await fetch(template)
  return Handlebars.compile(await response.text())
}

function buildTemplateConfigurator(options, targetNode, idPrefix = "") { 

  for (const [optionID, parameters] of Object.entries(options)) {
    console.log(optionID, parameters)
    let container = document.createElement('li')
    container.appendChild(Object.assign(document.createElement('label'), {
      innerHTML: parameters.label ?? optionID
    }))

    switch (parameters.type) {
      case 'list':
        let nestedContainer = document.createElement('ul')
        nestedContainer.id = idPrefix + optionID
        for (const [i, item] of parameters.items.entries()) {
          let itemContainer = document.createElement('li')
          itemContainer.appendChild(Object.assign(document.createElement('label'), {
            innerHTML: i
          }))
          let newTarget = document.createElement('ul') 
          buildTemplateConfigurator(item, newTarget, `${idPrefix}.${optionID}.${i}`)
          itemContainer.appendChild(newTarget)
          nestedContainer.appendChild(itemContainer)
        }
        container.appendChild(nestedContainer)
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

function handleFormSubmit(event) {
  event.preventDefault()

  const formData = new FormData(this)
  const data = {}

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

  updatePreview(data);
}

function updatePreview(data) {
  SHADOW_DOM.innerHTML = '';

  const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/lib/shadow.css';

  const wrap = document.createElement('div');
  wrap.className = 'shadow-content';
  wrap.innerHTML = DOMPurify.sanitize(currentTemplate(data), DOMPURIFY_OPTS);

  SHADOW_DOM.appendChild(link);
  SHADOW_DOM.appendChild(wrap);
}

async function setActiveTemplate(index) {
  let info = manifest[index]
  let metadata = await fetchJson(info.metadata)
  currentTemplate = await fetchTemplate(metadata.template)
  let editor = document.getElementById('editor-container')
  editor.innerHTML = ""
  previewDiv = buildTemplateConfigurator(metadata.options, editor)
  console.log(metadata)
}

function copyTemplate() {
  let template = SHADOW_DOM.querySelector('.shadow-content').innerHTML;

  navigator.clipboard.writeText(template)
    .then(() => alert(`
Output copied!
Now you can paste it into your character description!
    `))
    .catch(err => console.error("Copy failed:", err));
}

document.addEventListener("DOMContentLoaded", async function() {
  manifest = await fetchJson('templates/manifest.json')
  cardTemplate = await fetchTemplate('assets/templates/card.hbs')
  document.getElementById('editor-form').addEventListener('submit', handleFormSubmit)

  const tempDiv = document.createElement('div')
  for (const [index, item] of manifest.entries()) {
    tempDiv.innerHTML = cardTemplate({index, ...item})
    document.getElementById('template-list-container').appendChild(tempDiv.firstChild)
}

let data = {
  images: [
    { src: "https://file.garden/aTNlS0deYkPxCXcx/profile/st2_cmp.webp", pos: "80%" },
  ],
  prefix: "Hello",
}

//fetchTemplate("stripe_gallery.hbs")
//let result = template(data);
//previewDiv.innerHTML = result
});

document.getElementById('copyHtmlSnippet')
  .addEventListener("click", copyTemplate);
