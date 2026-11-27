import {
  AppModuleBlock,
  AppModuleRow,
  BlockFieldSchema,
  BlockTypeSchema,
} from "@adapters/http/superadmin.repository";
import {
  useBlockTypes,
  useCreateAppModule,
  useReorderAppModules,
  useUpdateModuleContent,
  useUploadImage,
} from "@adapters/query/superadmin";
import { resolveMediaUrl } from "@infrastructure/media-url";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Camera,
  CheckCircle2,
  FileText,
  Info,
  Link2,
  ListChecks,
  Menu,
  PiggyBank,
  Plus,
  Send,
  Trash2,
} from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { useState, type ChangeEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { formSelectClass, useMutationError } from "./shared";

type SectionDraft = {
  id: string;
  title: string;
  body: string;
  blocks: AppModuleBlock[];
  componentKeys: string[];
};

/** Client-side id: unique per editor session, stable per row while moving. */
const newSectionId = () =>
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const newBlockId = () =>
  `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Same icon language as the palette, so the composer reads at a glance. */
function BlockIcon({ type, className }: { type: string; className?: string }) {
  if (type === "stats") return <BarChart3 className={className} />;
  if (type === "steps") return <ListChecks className={className} />;
  if (type === "checklist") return <CheckCircle2 className={className} />;
  if (type === "links") return <Link2 className={className} />;
  if (type === "faq") return <FileText className={className} />;
  if (type === "cta") return <Send className={className} />;
  if (type === "image") return <Camera className={className} />;
  if (type === "emergency-fund") return <PiggyBank className={className} />;
  if (type === "divider") return <Menu className={className} />;
  return <Info className={className} />;
}

/** FileReader wrapper: the API receives the picked file as a data URL. */
const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Image picker for a block: upload from the device or paste a URL.
 *
 * The file is stored by the API and only its path lands in the block, so the
 * page keeps rendering even if the operator never touches a CDN. External
 * URLs still work, which keeps already-authored pages valid.
 */
function ImagePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const upload = useUploadImage();
  const onError = useMutationError();
  const [reading, setReading] = useState(false);
  const busy = reading || upload.isPending;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires `change`.
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      toast.error(t("superadmin.modules.blocks.image.unsupported"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("superadmin.modules.blocks.image.tooLarge"));
      return;
    }
    try {
      setReading(true);
      const dataUrl = await readAsDataUrl(file);
      upload.mutate(dataUrl, {
        onSuccess: ({ url }) => onChange(url),
        onError,
      });
    } catch {
      toast.error(t("superadmin.modules.blocks.image.readError"));
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={500}
          placeholder="/api/media/…"
          className="min-w-0 flex-1"
        />
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-teal-400/50 hover:text-teal-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-teal-300 ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          {busy
            ? t("superadmin.modules.blocks.image.uploading")
            : t("superadmin.modules.blocks.image.upload")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={handleFile}
            disabled={busy}
          />
        </label>
      </div>
      {value && (
        <img
          src={resolveMediaUrl(value)}
          alt=""
          className="h-28 w-full max-w-xs rounded-md border border-slate-200 object-cover dark:border-white/10"
        />
      )}
      <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        {t("superadmin.modules.blocks.image.hint")}
      </p>
    </div>
  );
}

/**
 * Form for one block, generated from the API schema.
 *
 * No block gets its own hardcoded form: adding a field to the registry makes
 * it editable here, which is what keeps the backoffice ahead of the code.
 */
function BlockFields({
  fields,
  value,
  idPrefix,
  onChange,
}: {
  fields: BlockFieldSchema[];
  value: Record<string, unknown>;
  idPrefix: string;
  onChange: (name: string, next: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const current =
          typeof value[field.name] === "string"
            ? (value[field.name] as string)
            : "";
        const wide = field.input !== "text" || field.name === "title";
        return (
          <div
            key={field.name}
            className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}
          >
            <Label htmlFor={id}>
              {t(`superadmin.modules.blocks.fields.${field.name}`)}
            </Label>
            {field.input === "textarea" ? (
              <textarea
                id={id}
                value={current}
                onChange={(event) => onChange(field.name, event.target.value)}
                rows={2}
                maxLength={field.maxLength}
                className={`${formSelectClass} h-auto py-2`}
              />
            ) : field.input === "image" ? (
              <ImagePicker
                id={id}
                value={current}
                onChange={(next) => onChange(field.name, next)}
              />
            ) : field.input === "select" ? (
              <select
                id={id}
                value={current}
                onChange={(event) => onChange(field.name, event.target.value)}
                className={formSelectClass}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`superadmin.modules.blocks.tones.${option.labelKey}`)}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                value={current}
                onChange={(event) => onChange(field.name, event.target.value)}
                maxLength={field.maxLength}
                placeholder={t(
                  `superadmin.modules.blocks.fields.${field.name}`,
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Authors what a page actually says, from the backoffice.
 *
 * Sections are the page body: ordered blocks with a heading, a text and the
 * components that belong to them. The same panel reorders the page's tabs and
 * registers new components on it, so "I created a page" and "the page has
 * content and order" are one screen instead of three.
 */
export function PageContentEditor({
  module,
  modules,
}: {
  module: AppModuleRow;
  modules: AppModuleRow[];
}) {
  const { t } = useTranslation();
  const saveContent = useUpdateModuleContent();
  const reorder = useReorderAppModules();
  const create = useCreateAppModule();
  const { data: blockTypes, isLoading: blocksLoading } = useBlockTypes();
  const onError = useMutationError();

  const [sections, setSections] = useState<SectionDraft[]>(() =>
    (module.content?.sections ?? []).map((section) => ({
      ...section,
      blocks: section.blocks ?? [],
    })),
  );
  const [componentName, setComponentName] = useState("");
  const [componentKey, setComponentKey] = useState("");

  // Tabs are siblings of the page: order is `sortOrder`, then name.
  const tabs = modules
    .filter((entry) => entry.kind === "tab" && entry.parentKey === module.key)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  // Components are building blocks: they can be attached anywhere, so the
  // operator is not forced to create one before placing it.
  const components = modules.filter((entry) => entry.kind === "component");

  const patch = (index: number, changes: Partial<SectionDraft>) =>
    setSections((current) =>
      current.map((section, position) =>
        position === index ? { ...section, ...changes } : section,
      ),
    );

  const moveSection = (index: number, offset: number) => {
    const target = index + offset;
    setSections((current) => {
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleComponent = (index: number, key: string) => {
    const keys = sections[index].componentKeys;
    patch(index, {
      componentKeys: keys.includes(key)
        ? keys.filter((candidate) => candidate !== key)
        : [...keys, key],
    });
  };

  const itemsOf = (block: AppModuleBlock): Array<Record<string, unknown>> =>
    Array.isArray(block.props.items)
      ? (block.props.items as Array<Record<string, unknown>>)
      : [];

  const patchBlock = (
    sectionIndex: number,
    blockIndex: number,
    changes: Partial<AppModuleBlock>,
  ) => {
    const blocks = sections[sectionIndex].blocks.map((block, position) =>
      position === blockIndex ? { ...block, ...changes } : block,
    );
    patch(sectionIndex, { blocks });
  };

  const patchBlockProps = (
    sectionIndex: number,
    blockIndex: number,
    name: string,
    value: unknown,
  ) => {
    const block = sections[sectionIndex].blocks[blockIndex];
    patchBlock(sectionIndex, blockIndex, {
      props: { ...block.props, [name]: value },
    });
  };

  const addBlock = (sectionIndex: number, schema: BlockTypeSchema) => {
    // Mirrors the API default so a new block is already valid on screen.
    const props: Record<string, unknown> = {};
    for (const field of schema.fields) {
      props[field.name] =
        field.input === "select" ? field.options?.[0]?.value ?? "" : "";
    }
    if (schema.items) props.items = [];
    patch(sectionIndex, {
      blocks: [
        ...sections[sectionIndex].blocks,
        { id: newBlockId(), type: schema.type, props },
      ],
    });
  };

  const moveBlock = (
    sectionIndex: number,
    blockIndex: number,
    offset: number,
  ) => {
    const blocks = [...sections[sectionIndex].blocks];
    const target = blockIndex + offset;
    if (target < 0 || target >= blocks.length) return;
    [blocks[blockIndex], blocks[target]] = [blocks[target], blocks[blockIndex]];
    patch(sectionIndex, { blocks });
  };

  const removeBlock = (sectionIndex: number, blockIndex: number) =>
    patch(sectionIndex, {
      blocks: sections[sectionIndex].blocks.filter(
        (_, position) => position !== blockIndex,
      ),
    });

  const changeItem = (
    sectionIndex: number,
    blockIndex: number,
    itemIndex: number,
    field: string,
    value: string,
  ) => {
    const items = itemsOf(sections[sectionIndex].blocks[blockIndex]).map(
      (item, position) =>
        position === itemIndex ? { ...item, [field]: value } : item,
    );
    patchBlockProps(sectionIndex, blockIndex, "items", items);
  };

  const addItem = (sectionIndex: number, blockIndex: number) => {
    const items = itemsOf(sections[sectionIndex].blocks[blockIndex]);
    patchBlockProps(sectionIndex, blockIndex, "items", [...items, {}]);
  };

  const removeItem = (
    sectionIndex: number,
    blockIndex: number,
    itemIndex: number,
  ) => {
    const items = itemsOf(sections[sectionIndex].blocks[blockIndex]);
    patchBlockProps(
      sectionIndex,
      blockIndex,
      "items",
      items.filter((_, position) => position !== itemIndex),
    );
  };

  const save = () => {
    saveContent.mutate(
      { id: module.id, content: { sections } },
      {
        onSuccess: (saved) => {
          // The server re-slugs ids and drops empty rows; mirror that here so
          // the editor shows exactly what the app will render.
          setSections(
            (saved.content?.sections ?? []).map((section) => ({
              ...section,
              blocks: section.blocks ?? [],
            })),
          );
          toast.success(t("superadmin.modules.content.saved"));
        },
        onError,
      },
    );
  };

  const moveTab = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= tabs.length) return;
    const next = [...tabs];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(
      next.map((tab) => tab.key),
      {
        onSuccess: () =>
          toast.success(t("superadmin.modules.content.tabsSaved")),
        onError,
      },
    );
  };

  const addComponent = () => {
    create.mutate(
      {
        key: componentKey.trim().toLowerCase(),
        name: componentName.trim(),
        kind: "component",
        parentKey: module.key,
        category: module.category,
        status: module.status,
      },
      {
        onSuccess: (created) => {
          setComponentName("");
          setComponentKey("");
          toast.success(
            t("superadmin.modules.content.componentAdded", {
              name: created.name,
            }),
          );
        },
        onError,
      },
    );
  };

  const moveButton =
    "rounded-md p-1 text-slate-400 transition-colors hover:bg-teal-500/10 hover:text-teal-600 disabled:opacity-30 dark:hover:text-teal-300";

  return (
    <section className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.content.title")}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.content.hint")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setSections((current) => [
              ...current,
              {
                id: newSectionId(),
                title: "",
                body: "",
                blocks: [],
                componentKeys: [],
              },
            ])
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("superadmin.modules.content.addSection")}
        </Button>
      </div>

      {!sections.length && (
        <p className="rounded-lg border border-dashed border-slate-300/70 px-3 py-4 text-center text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          {t("superadmin.modules.content.noSections")}
        </p>
      )}

      {sections.map((section, index) => (
        <article
          key={section.id}
          className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="flex items-center gap-1">
            <span className="mr-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {t("superadmin.modules.content.sectionNumber", { n: index + 1 })}
            </span>
            <button
              type="button"
              onClick={() => moveSection(index, -1)}
              disabled={index === 0}
              title={t("superadmin.modules.content.moveUp")}
              aria-label={t("superadmin.modules.content.moveUp")}
              className={moveButton}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => moveSection(index, 1)}
              disabled={index === sections.length - 1}
              title={t("superadmin.modules.content.moveDown")}
              aria-label={t("superadmin.modules.content.moveDown")}
              className={moveButton}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSections((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
              title={t("superadmin.modules.content.removeSection")}
              aria-label={t("superadmin.modules.content.removeSection")}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <Input
            value={section.title}
            onChange={(event) => patch(index, { title: event.target.value })}
            placeholder={t("superadmin.modules.content.sectionTitle")}
            aria-label={t("superadmin.modules.content.sectionTitle")}
            maxLength={120}
          />
          <textarea
            value={section.body}
            onChange={(event) => patch(index, { body: event.target.value })}
            placeholder={t("superadmin.modules.content.sectionBody")}
            aria-label={t("superadmin.modules.content.sectionBody")}
            rows={3}
            maxLength={4000}
            className={`${formSelectClass} h-auto py-2`}
          />

          {/* Blocks are the actual page UI: the operator picks one from the
              palette and fills generated fields, no code or deploy involved. */}
          <div className="space-y-2 rounded-lg border border-dashed border-slate-300/70 bg-slate-50/40 p-2 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("superadmin.modules.blocks.title")}
              </p>
              <span className="text-[10px] text-slate-400">
                {section.blocks.length}
              </span>
            </div>

            {!section.blocks.length && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {t("superadmin.modules.blocks.empty")}
              </p>
            )}

            {section.blocks.map((block, blockIndex) => {
              const schema = blockTypes?.find(
                (candidate) => candidate.type === block.type,
              );
              const items = itemsOf(block);
              const itemSchema = schema?.items;
              return (
                <article
                  key={block.id}
                  className="space-y-2 rounded-md border border-slate-200 bg-white/80 p-2.5 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-1">
                    <BlockIcon
                      type={block.type}
                      className="h-3.5 w-3.5 shrink-0 text-teal-500 dark:text-teal-300"
                    />
                    <span className="mr-auto min-w-0 truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      {t(`superadmin.modules.blocks.types.${block.type}`) ||
                        block.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, blockIndex, -1)}
                      disabled={blockIndex === 0}
                      title={t("superadmin.modules.content.moveUp")}
                      aria-label={t("superadmin.modules.content.moveUp")}
                      className={moveButton}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, blockIndex, 1)}
                      disabled={blockIndex === section.blocks.length - 1}
                      title={t("superadmin.modules.content.moveDown")}
                      aria-label={t("superadmin.modules.content.moveDown")}
                      className={moveButton}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(index, blockIndex)}
                      title={t("superadmin.modules.blocks.remove")}
                      aria-label={t("superadmin.modules.blocks.remove")}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {schema ? (
                    <>
                      <BlockFields
                        fields={schema.fields}
                        value={block.props}
                        idPrefix={`${module.id}-${section.id}-${block.id}`}
                        onChange={(name, next) =>
                          patchBlockProps(index, blockIndex, name, next)
                        }
                      />
                      {itemSchema && (
                        <div className="space-y-2 rounded-md border border-slate-200/70 p-2 dark:border-white/10">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                              {t("superadmin.modules.blocks.items")}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {items.length}/{itemSchema.max}
                            </span>
                          </div>
                          {items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="space-y-1.5 border-t border-slate-200/70 pt-2 first:border-t-0 first:pt-0 dark:border-white/10"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400">
                                  {t("superadmin.modules.blocks.item", {
                                    n: itemIndex + 1,
                                  })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(index, blockIndex, itemIndex)
                                  }
                                  title={t(
                                    "superadmin.modules.blocks.removeItem",
                                  )}
                                  aria-label={t(
                                    "superadmin.modules.blocks.removeItem",
                                  )}
                                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <BlockFields
                                fields={itemSchema.fields}
                                value={item}
                                idPrefix={`${module.id}-${section.id}-${block.id}-${itemIndex}`}
                                onChange={(name, next) =>
                                  changeItem(
                                    index,
                                    blockIndex,
                                    itemIndex,
                                    name,
                                    next,
                                  )
                                }
                              />
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addItem(index, blockIndex)}
                            disabled={items.length >= (itemSchema?.max ?? 0)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {t("superadmin.modules.blocks.addItem")}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-600 dark:text-amber-300">
                      {t("superadmin.modules.blocks.unknown", {
                        type: block.type,
                      })}
                    </p>
                  )}
                </article>
              );
            })}

            <div className="flex flex-wrap gap-1.5">
              {blockTypes?.map((schema) => (
                <button
                  key={schema.type}
                  type="button"
                  onClick={() => addBlock(index, schema)}
                  title={t(`superadmin.modules.blocks.hints.${schema.type}`)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-teal-400/50 hover:text-teal-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-teal-300"
                >
                  <BlockIcon type={schema.type} className="h-3.5 w-3.5" />
                  {t(`superadmin.modules.blocks.types.${schema.type}`)}
                </button>
              ))}
              {blocksLoading && (
                <span className="text-[11px] text-slate-400">
                  {t("superadmin.modules.blocks.loading")}
                </span>
              )}
            </div>
          </div>

          {module.kind !== "component" && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("superadmin.modules.content.sectionComponents")}
              </p>
              {components.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {components.map((component) => {
                    const checked = section.componentKeys.includes(
                      component.key,
                    );
                    return (
                      <label
                        key={component.key}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          checked
                            ? "border-teal-400/60 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                            : "border-slate-200 text-slate-500 hover:border-teal-300/60 dark:border-white/10 dark:text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleComponent(index, component.key)}
                        />
                        {component.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t("superadmin.modules.content.noComponents")}
                </p>
              )}
            </div>
          )}
        </article>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={saveContent.isPending}
        >
          {t("superadmin.modules.content.save")}
        </Button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.content.saveHint")}
        </span>
      </div>

      {module.kind === "page" && (
        <div className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-white/[0.08]">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.content.tabsTitle")}
          </h4>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.content.tabsHint")}
          </p>
          {tabs.length ? (
            tabs.map((tab, index) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-2 py-1 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">
                  {index + 1}. {tab.name}
                </span>
                <button
                  type="button"
                  onClick={() => moveTab(index, -1)}
                  disabled={index === 0 || reorder.isPending}
                  title={t("superadmin.modules.content.moveUp")}
                  aria-label={t("superadmin.modules.content.moveUp")}
                  className={moveButton}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTab(index, 1)}
                  disabled={index === tabs.length - 1 || reorder.isPending}
                  title={t("superadmin.modules.content.moveDown")}
                  aria-label={t("superadmin.modules.content.moveDown")}
                  className={moveButton}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {t("superadmin.modules.content.noTabs")}
            </p>
          )}
        </div>
      )}

      {module.kind === "page" && (
        <div className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-white/[0.08]">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.content.addComponentTitle")}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={componentName}
              onChange={(event) => setComponentName(event.target.value)}
              placeholder={t("superadmin.modules.name")}
              aria-label={t("superadmin.modules.name")}
              maxLength={120}
            />
            <Input
              value={componentKey}
              onChange={(event) => setComponentKey(event.target.value)}
              placeholder={t("superadmin.modules.key")}
              aria-label={t("superadmin.modules.key")}
              pattern="[a-z0-9][a-z0-9-]*"
              maxLength={80}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addComponent}
            disabled={
              create.isPending ||
              componentName.trim().length < 2 ||
              componentKey.trim().length < 2
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("superadmin.modules.content.addComponent")}
          </Button>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.content.addComponentHint")}
          </p>
        </div>
      )}
    </section>
  );
}
