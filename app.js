let comunas = [];
let sucursales = [];
let derivaciones = [];

const input = document.getElementById("inputComuna");
const autocompleteList = document.getElementById("autocomplete-list");
const btnBuscar = document.getElementById("btnBuscar");

let indexSeleccionado = -1;

/* ======================
   CARGA DE DATOS
====================== */
Promise.all([
  fetch("data/comunas.json").then(res => res.json()),
  fetch("data/sucursales.json").then(res => res.json()),
  fetch("data/derivacion_comuna.json").then(res => res.json())
]).then(data => {
  comunas = data[0];
  sucursales = data[1];
  derivaciones = data[2];
});

/* ======================
   NORMALIZAR TEXTO
====================== */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ======================
   AUTOCOMPLETADO
====================== */
input.addEventListener("input", () => {
  const valor = normalizar(input.value);
  autocompleteList.innerHTML = "";
  indexSeleccionado = -1;

  if (!valor) return;

  const empiezaCon = [];
  const contiene = [];

  comunas.forEach(c => {
    const nombre = c.comuna;
    const normalizado = normalizar(nombre);

    if (normalizado.startsWith(valor)) {
      empiezaCon.push(nombre);
    } else if (normalizado.includes(valor)) {
      contiene.push(nombre);
    }
  });

  const sugerencias = [
    ...empiezaCon.sort((a, b) => a.localeCompare(b, "es")),
    ...contiene.sort((a, b) => a.localeCompare(b, "es"))
  ].slice(0, 8);

  sugerencias.forEach(comuna => {
    const div = document.createElement("div");
    div.className = "autocomplete-item";
    div.textContent = comuna;

    div.addEventListener("click", () => {
      input.value = comuna;
      autocompleteList.innerHTML = "";
      ejecutarBusqueda();
    });

    autocompleteList.appendChild(div);
  });
});

/* ======================
   TECLADO ↑ ↓ TAB ENTER
====================== */
input.addEventListener("keydown", e => {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");
  if (items.length === 0) return;

  if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
    e.preventDefault();
    indexSeleccionado = (indexSeleccionado + 1) % items.length;
    activarItem(items);
  }

  if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
    e.preventDefault();
    indexSeleccionado--;
    if (indexSeleccionado < 0) indexSeleccionado = items.length - 1;
    activarItem(items);
  }

  if (e.key === "Enter") {
    e.preventDefault();
    if (indexSeleccionado > -1) {
      items[indexSeleccionado].click();
    }
  }
});

/* ======================
   ACTIVAR ITEM
====================== */
function activarItem(items) {
  items.forEach(item => item.classList.remove("active"));
  if (items[indexSeleccionado]) {
    items[indexSeleccionado].classList.add("active");
  }
}

/* ======================
   BOTÓN BUSCAR
====================== */
btnBuscar.addEventListener("click", () => {
  autocompletarSiCorresponde();
  ejecutarBusqueda();
});

/* ======================
   AUTOCOMPLETAR SI HACE FALTA
====================== */
function autocompletarSiCorresponde() {
  const valor = normalizar(input.value);

  const existeExacta = comunas.some(
    c => normalizar(c.comuna) === valor
  );

  if (existeExacta) return;

  const primerItem = autocompleteList.querySelector(".autocomplete-item");
  if (primerItem) {
    input.value = primerItem.textContent;
  }
}

/* ======================
   EJECUTAR BÚSQUEDA
====================== */
function ejecutarBusqueda() {
  autocompleteList.innerHTML = "";
  const comunaIngresada = input.value.trim();
  const resultados = buscarSucursales(comunaIngresada);
  mostrarResultados(resultados, comunaIngresada);
}

/* ======================
   BÚSQUEDA INTELIGENTE
====================== */
function buscarSucursales(nombreComuna) {
  if (!nombreComuna) return [];

  const regla = derivaciones.find(
    d => normalizar(d.comuna) === normalizar(nombreComuna)
  );

  if (!regla) return [];

  let lista = [];

  if (regla.propia) {
    sucursales
      .filter(s => normalizar(s.comuna) === normalizar(nombreComuna))
      .forEach(s => lista.push(s));
  }

  if (Array.isArray(regla.derivacion)) {
    regla.derivacion
      .sort((a, b) => a.prioridad - b.prioridad)
      .forEach(d => {
        const suc = sucursales.find(s => s.id === d.idSucursal);
        if (suc && !lista.some(x => x.id === suc.id)) {
          lista.push(suc);
        }
      });
  }

  return lista.slice(0, 5);
}

/* ======================
   MOSTRAR RESULTADOS (TABLA ACCESIBLE)
====================== */
function mostrarResultados(lista, comunaIngresada) {
  const contenedor = document.getElementById("resultados");
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML = "<p role='alert'>NO SE ENCONTRARON SUCURSALES CERCANAS.</p>";
    return;
  }

  // Obtener región de la comuna ingresada
  const comunaObj = comunas.find(c => normalizar(c.comuna) === normalizar(comunaIngresada));
  const regionComuna = comunaObj ? comunaObj.region : "Desconocida";

  const tabla = document.createElement("table");
  tabla.className = "tabla-resultados";
  tabla.setAttribute("aria-label", `Sucursales cercanas de ${comunaIngresada}`);

  tabla.innerHTML = `
    <thead>
      <tr>
        <th>COMUNA</th>
        <th>REGIÓN</th>
        <th>DIRECCIÓN</th>
        <th>TIPO</th>
        <th>HORARIO</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = tabla.querySelector("tbody");

  lista.forEach(s => {
    let colorTipo = "white";
    if (s.tipo.toLowerCase().includes("express")) colorTipo = "red";
    if (s.tipo.toLowerCase().includes("beco")) colorTipo = "skyblue";

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td tabindex="0">${s.comuna}</td>
      <td tabindex="0">${s.region || regionComuna}</td>
      <td tabindex="0">${s.direccion}</td>
      <td tabindex="0" style="color:${colorTipo}">${s.tipo}</td>
      <td tabindex="0">${s.horario}</td>
    `;
    tbody.appendChild(fila);
  });

  contenedor.appendChild(tabla);
}
