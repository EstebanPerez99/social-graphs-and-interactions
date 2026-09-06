# Comandos básicos

Chuleta para este proyecto. Todo asume que estás parado en la carpeta del curso:

```bash
cd ~/Documents/progra/social-graphs-and-interactions
```

---

## ⚠️ Lo más importante: usa `uv pip`, no `pip`

Este entorno se creó con **uv**, que no instala `pip` adentro. Esto es lo que pasa
si lo intentas de todos modos (probado, con el venv activo):

- `pip install algo` → `command not found: pip` — simplemente no existe
- `pip3 install algo` → se va al `pip3` global de Homebrew y falla con
  `error: externally-managed-environment`. **Nunca instala en tu venv**, aunque esté activo.

| ❌ No uses | ✅ Usa |
|---|---|
| `pip install networkx` | `uv pip install networkx` |
| `pip3 install networkx` | `uv pip install networkx` |
| `pip list` | `uv pip list` |
| `pip freeze` | `uv pip freeze` |

`uv pip` es el reemplazo directo: mismos comandos, misma sintaxis, y sí respeta el venv.

---

## Entorno virtual

### Activarlo

```bash
source .venv/bin/activate
```

### Saber si está activo

La señal más clara es el prompt: aparece el nombre del entorno entre paréntesis.

```
(social-graphs-and-interactions) esteban@mac social-graphs-and-interactions %
```

Si quieres confirmarlo sin lugar a dudas:

```bash
which python        # debe apuntar a .../social-graphs-and-interactions/.venv/bin/python
python -V           # Python 3.14.5
echo $VIRTUAL_ENV   # la ruta del venv, o vacío si no hay ninguno activo
```

Si `which python` apunta a `/usr/bin/python3` o `/opt/homebrew/bin/python3`, **no está activo**.

### Desactivarlo

```bash
deactivate
```

### Trabajar sin activarlo

No es obligatorio activar. Puedes llamar al Python del entorno directamente:

```bash
.venv/bin/python mi_script.py
.venv/bin/jupyter lab
```

Es lo más seguro cuando no estás seguro de qué está activo.

---

## Jupyter

### Abrir JupyterLab

```bash
jupyter lab                    # con el venv activo
.venv/bin/jupyter lab          # sin activarlo
```

Se abre solo en el navegador. Para cerrarlo: `Ctrl+C` en la terminal (dos veces).

### En Cursor

Abre la carpeta del curso y Cursor detecta el `.venv` automáticamente.
Al abrir un `.ipynb`, arriba a la derecha elige el kernel **Python (Social Graphs)**.

### Ejecutar un notebook completo desde la terminal

```bash
jupyter nbconvert --to notebook --execute --inplace notebooks/mi-notebook.ipynb
```

Útil para verificar que todo corre sin abrir nada.

### Exportar para entregar

```bash
jupyter nbconvert --to html notebooks/mi-notebook.ipynb      # funciona ya
jupyter nbconvert --to pdf  notebooks/mi-notebook.ipynb      # requiere LaTeX (ver abajo)
```

Para PDF hace falta instalar LaTeX aparte:

```bash
brew install --cask basictex   # pesado; solo si el curso pide PDF
```

Alternativa sin instalar nada: exporta a HTML, ábrelo en el navegador e imprime a PDF.

---

## Instalar paquetes

### Instalar algo nuevo

```bash
uv pip install nombre-del-paquete
```

Varios de golpe:

```bash
uv pip install seaborn python-louvain tqdm
```

Después de instalar algo, **actualiza el `requirements.txt`**:

```bash
uv pip freeze > requirements.txt
```

Así el entorno se puede recrear igualito más adelante.

### Ver qué está instalado

```bash
uv pip list                  # todo
uv pip list | grep networkx  # buscar uno
uv pip show networkx         # versión, ubicación y de qué depende
```

### Actualizar o quitar

```bash
uv pip install --upgrade networkx
uv pip uninstall networkx
```

### Paquetes que quizá pida el curso

```bash
uv pip install python-louvain    # detección de comunidades (versión clásica)
uv pip install seaborn           # gráficas estadísticas más bonitas
uv pip install wordcloud         # nubes de palabras (común en análisis de redes)
uv pip install tqdm              # barras de progreso en loops largos
uv pip install beautifulsoup4    # scraping de HTML
```

> Nota: NetworkX ya trae Louvain integrado (`nx.community.louvain_communities`),
> así que `python-louvain` solo hace falta si el material del curso lo usa explícitamente.

---

## Recrear el entorno desde cero

Si el `.venv/` se rompe, lo borras, o clonas esto en otra máquina:

```bash
rm -rf .venv
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

Y para volver a registrar el kernel en Jupyter:

```bash
.venv/bin/python -m ipykernel install --user \
  --name social-graphs --display-name "Python (Social Graphs)"
```

---

## Kernels de Jupyter

```bash
jupyter kernelspec list                      # ver los kernels registrados
jupyter kernelspec uninstall nombre-kernel   # borrar uno que ya no uses
```

---

## Problemas comunes

**`ModuleNotFoundError: No module named 'X'` aunque lo acabas de instalar**
El notebook está usando otro kernel. En Cursor/Jupyter cambia el kernel a
**Python (Social Graphs)** y reinicia (`Restart Kernel`).

**`command not found: jupyter`**
No está activo el venv. Corre `source .venv/bin/activate`, o llama a `.venv/bin/jupyter`.

**`error: externally-managed-environment`**
Usaste `pip3` en vez de `uv pip`. Pasa aunque el venv esté activo. Ver la sección de arriba.

**`command not found: pip`**
Normal — este venv no trae `pip`. Usa `uv pip` en su lugar.

**El notebook se queda "colgado" ejecutando**
`Kernel → Interrupt` para cortar la celda, o `Kernel → Restart` si no responde.

**El puerto 8888 está ocupado**
Ya tienes otro Jupyter corriendo. Ciérralo, o usa otro puerto:
```bash
jupyter lab --port=8899
```

**Los gráficos no aparecen en el notebook**
Falta `plt.show()` al final de la celda, o `import matplotlib.pyplot as plt` arriba.

---

## Git (opcional)

Todavía no está inicializado. Si lo quieres:

```bash
git init
git add .
git commit -m "setup inicial del curso"
```

El `.gitignore` ya está configurado para excluir `.venv/`, `data/`, `figures/`
y los checkpoints de Jupyter.

---

## El sitio (Astro + React)

```bash
cd site
npm install            # solo la primera vez, o si cambió package.json
npm run dev            # servidor local con recarga → http://localhost:4321/social-graphs-and-interactions/
npm run build          # compila a site/dist/ (lo mismo que hace la Action)
npm run preview        # sirve site/dist/ tal cual quedará publicado
```

Los posts viven en `site/src/content/posts/weekN.mdx`. Mientras tengan `draft: true` no aparecen en el sitio.
Los componentes interactivos (`DegreePlot`, `NetworkGraph`, `AdjacencyMatrix`) están en `site/src/components/`
y se usan dentro del MDX como `<DegreePlot client:visible data={...} />`.

**Publicar** = hacer push a `main`. La GitHub Action compila `site/` y lo sube a Pages en ~1 minuto.

```bash
git add -A
git commit -m "week 2 post"
git push
```

---

## Nueva semana

```bash
python -m sgi new-week 2          # crea notebooks/week2, data/week2, figures/week2 y el post borrador
python -m sgi new-week 3 --topic "Who matters, and why"
```

Luego: descargar los datos a `data/weekN/`, correr `notebooks/weekN/N.8-go-nuts.ipynb`,
escribir el post y quitarle `draft: true`.

---

## El paquete `sgi`

Se importa desde cualquier notebook (está instalado en modo editable):

```python
import sgi
G, nodes = sgi.load_marvel(week=1)        # DiGraph con los 303 nodos (aislados incluidos) + DataFrame
table    = sgi.degree_table(G, nodes)     # node_id, name, in_degree, out_degree, degree
sgi.top(table, "in", 5)                   # top-5 por in-degree ("out", "und" también)
raw      = sgi.raw_distribution(table.in_degree)   # k, u=k+1, count, p
binned   = sgi.goodies_bins(table.in_degree)       # el binning de los Goodies
fig      = sgi.degree_panels(table)       # 2x2: in/out × lineal/log-log
sgi.save_fig(fig, "nombre", week=1)       # figures/week1/ + site/src/assets/week1/
sgi.save_json(obj, "nombre", week=1)      # data/week1/exports/ + site/src/data/week1/
```

Si cambias algo en `sgi/`, reinicia el kernel del notebook para que lo vea.

---

## NetworkX — lo más usado

```python
import networkx as nx

G = nx.Graph()                        # grafo no dirigido
G = nx.DiGraph()                      # grafo dirigido

G.add_node(1)                         # agregar nodo
G.add_edge(1, 2)                      # agregar arista
G.add_edges_from([(1,2), (2,3)])      # varias de golpe

G.number_of_nodes()                   # cuántos nodos
G.number_of_edges()                   # cuántas aristas
G.degree(1)                           # conexiones del nodo 1
list(G.neighbors(1))                  # vecinos del nodo 1

nx.density(G)                         # qué tan conectada está la red
nx.average_shortest_path_length(G)    # separación promedio
nx.average_clustering(G)              # qué tanto los amigos son amigos entre sí
nx.degree_centrality(G)               # quién tiene más conexiones
nx.betweenness_centrality(G)          # quién sirve de puente
nx.connected_components(G)            # pedazos desconectados de la red

nx.community.louvain_communities(G)   # detectar comunidades

nx.draw_networkx(G, nx.spring_layout(G))   # dibujar
```
