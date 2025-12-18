import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SlashCommandMarkOptions {
  HTMLAttributes: Record<string, any>;
  onCommandClick?: (commandText: string, from: number, to: number) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    slashCommandMark: {
      setSlashCommand: () => ReturnType;
      unsetSlashCommand: () => ReturnType;
    };
  }
}

export const SlashCommandMark = Mark.create<SlashCommandMarkOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommandClick: undefined,
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-slash-command]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-slash-command': 'true',
        class: 'slash-command-badge',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSlashCommand:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      unsetSlashCommand:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    const { onCommandClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('slashCommandClick'),
        props: {
          handleClick: (view, pos, event) => {
            if (!onCommandClick) return false;

            const { state } = view;
            const { doc } = state;

            // Get the node at position
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();

            // Check if there's a slash command mark
            const slashMark = marks.find((m) => m.type.name === 'slashCommand');
            if (!slashMark) return false;

            // Find the extent of the marked text
            let from = pos;
            let to = pos;

            // Walk backwards to find start
            while (from > 0) {
              const $before = doc.resolve(from - 1);
              const beforeMarks = $before.marks();
              if (!beforeMarks.find((m) => m.type.name === 'slashCommand')) break;
              from--;
            }

            // Walk forwards to find end
            while (to < doc.content.size) {
              const $after = doc.resolve(to);
              const afterMarks = $after.marks();
              if (!afterMarks.find((m) => m.type.name === 'slashCommand')) break;
              to++;
            }

            // Get the text
            const commandText = doc.textBetween(from, to);
            
            if (commandText) {
              onCommandClick(commandText, from, to);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
