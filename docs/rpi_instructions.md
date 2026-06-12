# rpi_instructions.md

> **Propósito:** Esta guía práctica proporciona los prompts exactos para delegar tareas a agentes de IA (GitHub Copilot, Claude Code, Cursor, etc.) bajo el marco RPI (Research, Plan, Implement).
> **Para el framework completo** (checklists, clasificación de fallos, artefactos, anti-patrones), consulta [`docs/rpi/README.md`](rpi/README.md).

El framework RPI reduce la fricción, las suposiciones ocultas y el diseño prematuro de soluciones. Al interactuar con un agente de IA, **NUNCA** debes pedirle que "resuelva el problema" de una sola vez. Debes guiarlo secuencialmente a través de las tres fases, validando su salida en cada punto de control.

> 💡 **Tip:** Los prompts de esta guía asumen que el agente tiene acceso a los docs del framework en `docs/rpi/`.

---

## 🏗️ Requisitos Previos (Setup del Proyecto)

Antes de iniciar un nuevo ticket o requerimiento con el agente, asegúrate de que la estructura de tu proyecto esté preparada:

1. Asegúrate de que los documentos base del framework (`README.md`, `Research.md`, `Plan.md`, `Implement.md`, y las escalas de validación) estén ubicados en la carpeta `/docs` (o `/docs/rpi`) para que el agente tenga el contexto como referencia.
2. Inicia un nuevo esfuerzo creando un subdirectorio específico para la tarea, por ejemplo: `rpi/initiative-X/`. Aquí es donde el agente guardará los artefactos.

---

## 📜 Fase 1: Research (Investigación)

**Objetivo:** Convertir la incertidumbre en una comprensión estructurada del problema, usuarios y restricciones. El agente debe mapear el código sin proponer la solución final todavía.

### Paso 1: Inicializar el contexto

Copia y pega este prompt en el chat de tu agente de IA, reemplazando los valores entre corchetes:

> **Prompt para el Agente:**
> "I need to work on a new requirement: [DESCRIBE_PROBLEM_OR_PASTE_TICKET_HERE].
> We use the RPI (Research, Plan, Implement) framework. Please read `docs/README.md` and `docs/Research.md` to understand our process.
> Your first task is ONLY the Research phase. Analyze the codebase to clarify the scope and map affected code surfaces. Generate the artifact at `rpi/[TICKET-ID]/research.md` exactly as specified in the templates. You must include the FAR Scale output at the end. Do not write any production code yet."

### Paso 2: Validación Humana (Punto de Control)

*Revisa el archivo `research.md` generado.*

* ¿El puntaje de la escala FAR (Factual, Actionable, Relevant) tiene un **Mean ≥ 4.00**?.
* Si el puntaje es menor a 4.00 después de dos intentos, es un "Failure Trigger" y debes redefinir el problema.
* **Aprobación:** Si es correcto, procede a la Fase 2.

---

## 📝 Fase 2: Plan (Planificación Atómica)

**Objetivo:** Convertir la investigación en un camino ejecutable, dividiendo el alcance y definiendo la arquitectura.

### Paso 3: Instruir la creación del Plan

Una vez aprobado el documento de investigación, utiliza el siguiente prompt:

> **Prompt para el Agente:**
> "The Research phase is approved. Now, please read `docs/Plan.md`.
> Based on the `rpi/[TICKET-ID]/research.md` document, generate the technical implementation plan at `rpi/[TICKET-ID]/plan.md`. You must break down the solution into atomic, single-responsibility tasks using checkboxes (`- [ ]`). Explicitly define dependencies and include the FACTS Scale output. Do not start executing the tasks yet."

### Paso 4: Validación Humana (Punto de Control)

*Revisa el archivo `plan.md` generado.*

* ¿Cada tarea es atómica (ej. un solo comando, la edición de un solo archivo) y tiene una definición clara de "done"?.
* ¿El puntaje de la escala FACTS (Feasibility, Atomicity, Clarity, Testability, Size) tiene un **Mean ≥ 3.00**?.
* **Aprobación:** Si el plan es sólido y no tiene dependencias circulares, procede a la Fase 3.

---

## ⚙️ Fase 3: Implement (Ejecución Mecánica)

**Objetivo:** Entregar porciones significativas a producción, medir y adaptar. El agente ejecutará el plan mecánicamente.

### Paso 5: Instruir la Ejecución

Usa este prompt para que el agente comience a programar:

> **Prompt para el Agente:**
> "The Plan phase is approved (FACTS mean is >= 3.00). Please review `docs/Implement.md` for our execution rules.
> Begin executing the tasks defined in `rpi/[TICKET-ID]/plan.md` sequentially. For each task:
> 1. Write the code.
> 2. Run our quality gates: Build -> Lint -> Test.
> 3. Only if all gates pass, mark the task as complete (`- [x]`) in the plan document.
> 
> 
> Stop and ask for my review after completing Phase 1 of the plan, or immediately if any quality gate fails."

### Paso 6: Manejo de Errores y Postmortems (Solo si es necesario)

Si el agente se atasca o los tests fallan repetidamente (ej. 3+ fallos consecutivos), detén la iteración y consulta el sistema de clasificación de fallos en el [Failure Handling Framework](rpi/README.md#failure-handling-framework).

Según la gravedad del fallo, usa este prompt:

> **Prompt para el Agente:**
> "We have hit consecutive failures during implementation. Please halt coding.
> According to our Failure Handling Framework, generate a postmortem document at `rpi/[TICKET-ID]/implement-postmortem.md` detailing the failed task, the system state, root cause analysis, and recommended next steps."