import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { glob } from "glob";

import type { RsbuildPlugin } from "@rsbuild/core";

async function getMatchingFiles(pattern: string): Promise<string[]> {
  try {
    const files = await glob(pattern, { nodir: true });
    return files || [];
  } catch (err) {
    console.error("Error fetching i18n files:", err);
    return [];
  }
}

const createLangs = (prefix: string, values: Record<string, Record<string, string>>): Record<string, Record<string, string>> => {
  const langs = Object.keys(values).reduce((acc: Record<string, any>, lang: string) => {
    acc[lang] = Object.entries(values[lang]).reduce((obj: Record<string, string>, [item, value]) => {
      obj[`${prefix}.${item}`] = value;
      return obj;
    }, {});
    return acc;
  }, {});

  return langs;
};

const removePrefix = (obj: Record<string, any>): Record<string, any> => {
  const { $prefix, ...newObj } = obj;
  return newObj;
};

const removeDefault = (obj: Record<string, any>): Record<string, any> => {
  const { default: _, ...newObj } = obj;
  return newObj;
};

type Langs = Record<string, Record<string, string>>;

const mergeWithDefault = (values: Langs, languages: string[]): Langs => {
  const { default: defaultLang, ...otherLangs } = values;
  const mergedLangs: Langs = {};
  for (const lang of languages) {
    mergedLangs[lang] = { ...defaultLang, ...(otherLangs[lang] || {}) };
  }
  return mergedLangs;
};

const extractLangs = async (filePath: string, languages: string[], prefix?: string): Promise<Record<string, Record<string, string>> | null> => {
  try {
    const fileContent = await readFile(filePath, "utf-8");
    const jsonContent = JSON.parse(fileContent);
    const middle = jsonContent?.$prefix ? jsonContent?.$prefix : dirname(filePath).replace("src/", "");
    const values = jsonContent?.$prefix ? removePrefix(jsonContent) : jsonContent;

    return createLangs(prefix ? `${prefix}/${middle}` : middle, removeDefault(mergeWithDefault(values, languages)));
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
};

const mergeLangs = (...langs: Record<string, Record<string, string>>[]): Record<string, Record<string, string>> => {
  return langs.reduce(
    (acc, lang) => {
      for (const key in lang) {
        if (!acc[key]) {
          acc[key] = {};
        }
        Object.assign(acc[key], lang[key]);
      }
      return acc;
    },
    {} as Record<string, Record<string, string>>,
  );
};

const sortObjectByKeys = (obj: Record<string, Record<string, string>>): Record<string, Record<string, string>> => {
  const sortedObj: Record<string, Record<string, string>> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sortedObj[key] = Object.keys(obj[key])
        .sort()
        .reduce(
          (acc, subKey) => {
            acc[subKey] = obj[key][subKey];
            return acc;
          },
          {} as Record<string, string>,
        );
    });
  return sortedObj;
};

const generateLanguageFiles = async (pattern: string, outputDir: string, languages: string[], prefix?: string) => {
  const files = await getMatchingFiles(pattern);
  const langsList: Record<string, Record<string, string>>[] = [];

  for (const file of files) {
    const langs = await extractLangs(file, languages, prefix);
    if (langs) {
      langsList.push(langs);
    }
  }

  const mergedLangs = mergeLangs(...langsList);
  const sortedMergedLangs = sortObjectByKeys(mergedLangs);

  await mkdir(outputDir, { recursive: true });

  for (const lang in sortedMergedLangs) {
    const filePath = join(outputDir, `${lang}.json`);
    await writeFile(filePath, JSON.stringify(sortedMergedLangs[lang], null, 2), "utf-8");
  }
};

export type PluginLangsOptions = {
  pattern?: string;
  destination?: string;
  languages?: string[];
  prefix?: string;
};

export const pluginLangs = (options: PluginLangsOptions = {}): RsbuildPlugin => ({
  name: "devjskit:rsbuild-plugin-langs",

  setup(api) {
    // 匹配 src 目录下所有以 .i18n.json 结尾的以及 i18n.json 文件
    const pattern = options.pattern || "./src/**/{*.i18n.json,i18n.json}";
    const destination = options.destination || "langs";
    const languages = options.languages || ["en", "zh"];

    const generateFilesAndRebuild = async () => {
      await generateLanguageFiles(pattern, destination, languages, options.prefix);
    };

    api.onDevCompileDone(async () => {
      await generateFilesAndRebuild();
    });

    api.onBeforeStartDevServer(async () => {
      await generateFilesAndRebuild();
    });

    api.onBeforeBuild(async () => {
      await generateFilesAndRebuild();
    });
  },
});
