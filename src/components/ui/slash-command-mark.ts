import { Mark, mergeAttributes, getMarkRange } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SlashCommandMarkOptions {
  HTMLAttributes: Record<string, any>;
  onCommandClick?: (commandText: string, from: number, to: number) => void;
  onCommandDelete?: (from: number, to: number) => void;
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
      onCommandDelete: undefined,
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
    const { onCommandClick, onCommandDelete } = this.options;

    return [
      new Plugin({
        key: new PluginKey('slashCommandClick'),
        props: {
          handleClick: (view, pos, event) => {
            if (!onCommandClick && !onCommandDelete) return false;

            const { state } = view;
            const { doc, schema } = state;
            const $pos = doc.resolve(pos);

            // Use getMarkRange for reliable boundary calculation
            const markType = schema.marks.slashCommand;
            const range = getMarkRange($pos, markType);

            if (!range) return false;

            const commandText = doc.textBetween(range.from, range.to);
            if (!commandText) return false;

            // Check if click was on the "X" delete zone (last ~20px of badge)
            const target = event.target as HTMLElement;
            if (target.classList.contains('slash-command-badge')) {
              const rect = target.getBoundingClientRect();
              const clickX = event.clientX;
              const deleteZone = rect.right - 20;

              if (clickX >= deleteZone && onCommandDelete) {
                // Click on X - delete command
                onCommandDelete(range.from, range.to);
                return true;
              }
            }

            // Normal click - edit command
            if (onCommandClick) {
              onCommandClick(commandText, range.from, range.to);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
