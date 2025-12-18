import { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Emoji categories for the picker
const emojiCategories = [
  {
    name: 'Expressões',
    icon: '😀',
    emojis: ['😀', '😂', '😍', '😢', '😮', '😡', '🤔', '😴', '🙂', '😊', '😉', '🥰'],
  },
  {
    name: 'Símbolos',
    icon: '❤️',
    emojis: ['❤️', '👍', '👏', '🙏', '✅', '❌', '⭐', '🔥', '💪', '👀', '💡', '⚠️'],
  },
  {
    name: 'Comunicação',
    icon: '💬',
    emojis: ['💬', '💭', 'ℹ️', '❓', '📝', '📌', '🎯', '📢', '🔔', '📞', '✉️', '📧'],
  },
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

// Convert Markdown to HTML for the editor
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Headers
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Underline (HTML tag)
  html = html.replace(/<u>(.+?)<\/u>/g, '<u>$1</u>');
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  
  // Ordered lists (before converting to paragraphs)
  const orderedListPattern = /(?:^|\n)((?:\d+\. .+\n?)+)/g;
  html = html.replace(orderedListPattern, (match, listContent) => {
    const items = listContent.trim().split('\n').map((item: string) => {
      const text = item.replace(/^\d+\. /, '');
      return `<li>${text}</li>`;
    }).join('');
    return `<ol>${items}</ol>`;
  });
  
  // Unordered lists
  const unorderedListPattern = /(?:^|\n)((?:- .+\n?)+)/g;
  html = html.replace(unorderedListPattern, (match, listContent) => {
    const items = listContent.trim().split('\n').map((item: string) => {
      const text = item.replace(/^- /, '');
      return `<li>${text}</li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  });
  
  // Line breaks to paragraphs (but not inside lists)
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  
  for (const line of lines) {
    if (line.startsWith('<ul>') || line.startsWith('<ol>')) {
      inList = true;
      result.push(line);
    } else if (line.includes('</ul>') || line.includes('</ol>')) {
      inList = false;
      result.push(line);
    } else if (!inList && line.trim() && !line.startsWith('<h')) {
      result.push(`<p>${line}</p>`);
    } else {
      result.push(line);
    }
  }
  
  return result.join('');
}

// Convert HTML from the editor to Markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.+?)<\/h1>/g, '# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.+?)<\/h2>/g, '## $1\n');
  
  // Bold
  markdown = markdown.replace(/<strong>(.+?)<\/strong>/g, '**$1**');
  markdown = markdown.replace(/<b>(.+?)<\/b>/g, '**$1**');
  
  // Italic
  markdown = markdown.replace(/<em>(.+?)<\/em>/g, '*$1*');
  markdown = markdown.replace(/<i>(.+?)<\/i>/g, '*$1*');
  
  // Underline
  markdown = markdown.replace(/<u>(.+?)<\/u>/g, '<u>$1</u>');
  
  // Strikethrough
  markdown = markdown.replace(/<s>(.+?)<\/s>/g, '~~$1~~');
  markdown = markdown.replace(/<strike>(.+?)<\/strike>/g, '~~$1~~');
  markdown = markdown.replace(/<del>(.+?)<\/del>/g, '~~$1~~');
  
  // Unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
    return items.map((item: string) => {
      const text = item.replace(/<li[^>]*>|<\/li>/g, '').trim();
      return `- ${text}`;
    }).join('\n') + '\n';
  });
  
  // Ordered lists
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
    return items.map((item: string, index: number) => {
      const text = item.replace(/<li[^>]*>|<\/li>/g, '').trim();
      return `${index + 1}. ${text}`;
    }).join('\n') + '\n';
  });
  
  // Paragraphs to line breaks
  markdown = markdown.replace(/<p[^>]*>/g, '');
  markdown = markdown.replace(/<\/p>/g, '\n');
  
  // Remove other HTML tags
  markdown = markdown.replace(/<br\s*\/?>/g, '\n');
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  
  return markdown.trim();
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, tooltip, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 p-0',
            isActive && 'bg-accent text-accent-foreground'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  minHeight = '300px',
  className,
}: MarkdownEditorProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
          'prose-headings:font-semibold prose-headings:text-foreground',
          'prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-4',
          'prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-3',
          'prose-p:text-foreground prose-p:my-1.5',
          'prose-strong:text-foreground prose-strong:font-semibold',
          'prose-em:text-foreground',
          'prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-0.5'
        ),
        style: `min-height: ${minHeight}; padding: 12px;`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  });

  const insertEmoji = useCallback((emoji: string) => {
    if (editor) {
      editor.chain().focus().insertContent(emoji).run();
      setEmojiOpen(false);
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('border border-input rounded-lg overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b border-input bg-muted/30 flex-wrap">
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          tooltip="Título (H1)"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          tooltip="Subtítulo (H2)"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Negrito (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Itálico (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          tooltip="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="Riscado"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Inserir emoji
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-[280px] p-3" side="bottom" align="start">
            <div className="space-y-3">
              {emojiCategories.map((category) => (
                <div key={category.name}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{category.icon}</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {category.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {category.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className={cn(
                          'text-xl p-1.5 rounded-md transition-all duration-150',
                          'hover:bg-accent hover:scale-110',
                          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                          'active:scale-95'
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Styles for placeholder */}
      <style>{`
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .ProseMirror {
          outline: none;
        }
        .ProseMirror h1 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          margin-top: 1rem;
        }
        .ProseMirror h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          margin-top: 0.75rem;
        }
        .ProseMirror p {
          margin: 0.375rem 0;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
