/* jshint esversion: 6 */
let finalize;

const dataPromise = Promise.all([
  fetch("science-map.vl.json").then((r) => r.json()),
  fetch('data/combined-nodes.json').then(r => r.json()),
  fetch('data/combined-edges.json').then(r => r.json())
]);

function updateData() {
  if (finalize) {
    finalize();
    document.getElementById('visualization').innerHTML = '<em class="loading">Loading...</em>';
  }
  const sourceSelector = document.getElementById('source');
  sourceSelector.disabled = true;
  setTimeout(() => {
    dataPromise.then(([spec, nodes, edges]) => {
      const src = sourceSelector.value;
      if (src !== 'combined') {
        nodes = nodes.filter(n => n.src === src);
        edges = edges.filter(n => n.src === src);
      }
      spec.datasets.nodes = nodes;
      spec.datasets.edges = edges;
      document.getElementById('visualization').innerHTML = '';
      return vegaEmbed("#visualization", spec, { "renderer": "canvas", "actions": true });
    }).then((results) => {
      finalize = results.finalize;
      sourceSelector.disabled = false;
      console.log("Visualization successfully loaded");
    });
  }, 50);
}
