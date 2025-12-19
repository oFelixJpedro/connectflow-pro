import { Mark, mergeAttributes, getMarkRange } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface MediaTagMarkOptions {
  HTMLAttributes: Record<string, any>;
  onMediaClick?: (type: string, key: string, from: number, to: number) => void;
  onMediaDelete?: (from: number, to: number) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mediaTagMark: {
      setMediaTag: () => ReturnType;
      unsetMediaTag: () => ReturnType;
    };
  }
}

export const MediaTagMark = Mark.create<MediaTagMarkOptions>({
  name: 'mediaTag',

  addOptions() {
    return {
      HTMLAttributes: {},
      onMediaClick: undefined,
      onMediaDelete: undefined,
    };
  },

  addAttributes() {
    return {
      'data-media-type': {
        default: null,
        parseHTML: element => element.getAttribute('data-media-type'),
        renderHTML: attributes => {
          if (!attributes['data-media-type']) return {};
          return { 'data-media-type': attributes['data-media-type'] };
        },
      },
      'data-media-key': {
        default: null,
        parseHTML: element => element.getAttribute('data-media-key'),
        renderHTML: attributes => {
          if (!attributes['data-media-key']) return {};
          return { 'data-media-key': attributes['data-media-key'] };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-media-tag]',
        getAttrs: (element: HTMLElement) => {
          const type = element.getAttribute('data-media-type');
          const key = element.getAttribute('data-media-key');
          if (!type || !key) return false;
          return {
            'data-media-type': type,
            'data-media-key': key,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const mediaType = HTMLAttributes['data-media-type'] || '';
    const mediaKey = HTMLAttributes['data-media-key'] || '';
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-media-tag': 'true',
        'data-media-type': mediaType,
        'data-media-key': mediaKey,
        class: `media-tag-badge media-tag-${mediaType}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setMediaTag:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      unsetMediaTag:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    const { onMediaClick, onMediaDelete } = this.options;

    return [
      new Plugin({
        key: new PluginKey('mediaTagClick'),
        props: {
          handleClick: (view, pos, event) => {
            if (!onMediaClick && !onMediaDelete) return false;

            const { state } = view;
            const { doc, schema } = state;
            const $pos = doc.resolve(pos);

            // Use getMarkRange for reliable boundary calculation
            const markType = schema.marks.mediaTag;
            if (!markType) return false;
            
            const range = getMarkRange($pos, markType);
            if (!range) return false;

            const target = event.target as HTMLElement;
            if (!target.classList.contains('media-tag-badge') && 
                !target.closest('.media-tag-badge')) {
              return false;
            }

            const badgeElement = target.classList.contains('media-tag-badge') 
              ? target 
              : target.closest('.media-tag-badge') as HTMLElement;
            
            if (!badgeElement) return false;

            const mediaType = badgeElement.getAttribute('data-media-type') || '';
            const mediaKey = badgeElement.getAttribute('data-media-key') || '';

            // Check if click was on the "X" delete zone (last ~20px of badge)
            const rect = badgeElement.getBoundingClientRect();
            const clickX = event.clientX;
            const deleteZone = rect.right - 20;

            if (clickX >= deleteZone && onMediaDelete) {
              // Click on X - delete media tag
              onMediaDelete(range.from, range.to);
              return true;
            }

            // Normal click - edit media tag
            if (onMediaClick) {
              onMediaClick(mediaType, mediaKey, range.from, range.to);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
