import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/translations';
import { useChatbot } from '@/hooks/use-chatbot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useApp } from '@/context/app-context';
// Dialog / sources UI removed

const Chat: React.FC = () => {
  const { t } = useTranslation();
  const { messages, isLoading, userInput, setUserInput, sendMessage, isSending } = useChatbot();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [_, setLocation] = useLocation();
  const { user } = useApp();
  const firstName = (user?.fullName || 'there').split(' ')[0];

  // sources modal removed

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleShowOnMap = () => {
    // Map page has been removed; fallback to documents for related actions
    setLocation('/documents');
  };

  const handleAddToChecklist = () => {
    setLocation('/documents');
  };

  // Function to parse message content into answer and sources
  const parseMessageContent = (content: string) => {
    const sourceIndex = content.indexOf('Sources:\n');
    if (sourceIndex === -1) {
      return {
        answer: content,
        sources: []
      };
    }

    const answer = content.substring(0, sourceIndex).trim();
    const sourcesBlock = content.substring(sourceIndex + 'Sources:\n'.length);
    
    // Split sources while preserving multi-line content
    const sources = sourcesBlock
      .split(/\n(?=\d+\.\s+)/) // Split by numbered list pattern
      .filter(entry => entry.trim().length > 0)
      .map(entry => entry.trim());

    return {
      answer,
      sources
    };
  };

  // Linkify plain URLs and simple Markdown links safely
  const linkify = (text: string, keyPrefix: string) => {
    // Handle simple markdown link: [label](https://example.com)
    const mdMatch = text.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (mdMatch) {
      const [, label, href] = mdMatch;
      return (
        <a key={`${keyPrefix}-md`} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{label}</a>
      );
    }

    // Regex to find URLs in text and avoid trailing punctuation
    const urlSplitRegex = /(https?:\/\/[^\s)\]\}\>\"']*[A-Za-z0-9\/]?)/gi;
    const parts = text.split(urlSplitRegex);
    return parts.map((part, idx) => {
      const isUrl = /^https?:\/\/[^\s)\]\}\>\"']*[A-Za-z0-9\/]?$/i.test(part);
      if (isUrl) {
        return (
          <a key={`${keyPrefix}-lnk-${idx}`} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
            {part}
          </a>
        );
      }
      return <span key={`${keyPrefix}-txt-${idx}`}>{part}</span>;
    });
  };

  // Render paragraph with interactive tokens and linkified URLs
  const renderParagraph = (content: string, keyPrefix: string) => {
    const words = content.split(/(\s+)/); // keep spaces
    return words.map((word, i) => {
      if (/^\s+$/.test(word)) return <span key={`${keyPrefix}-sp-${i}`}>{word}</span>;
      const bare = word.replace(/[.,!?;:]+$/, '');
      const lower = bare.toLowerCase();

      if (lower.includes('location')) {
        return (
          <Button
            key={`${keyPrefix}-loc-${i}`}
            onClick={handleShowOnMap}
            className="inline px-2 py-1 mx-1 my-1 text-sm rounded-full bg-popover text-primary hover:bg-primary/10 transition"
          >
            {word}
          </Button>
        );
      }
      if (lower.includes('document')) {
        return (
          <span key={`${keyPrefix}-doc-${i}`} onClick={handleAddToChecklist} className="cursor-pointer">{word}</span>
        );
      }
      return <span key={`${keyPrefix}-w-${i}`}>{linkify(word, `${keyPrefix}-lk-${i}`)}</span>;
    });
  };

  // Render content: detect bullet lists and render as list items; otherwise paragraphs
  const renderContent = (content: string) => {
    const lines = content.split(/\r?\n/);
    const blocks: Array<{ type: 'list' | 'para'; items?: string[]; text?: string }> = [];
    let currentList: string[] | null = null;
    const listPattern = /^\s*(?:[-*•]|\d+\.)\s+/;

    for (const line of lines) {
      if (listPattern.test(line)) {
        if (!currentList) {
          if (blocks.length && blocks[blocks.length - 1].type === 'para' && blocks[blocks.length - 1].text === '') {
            blocks.pop();
          }
          currentList = [];
          blocks.push({ type: 'list', items: currentList });
        }
        currentList.push(line.replace(listPattern, ''));
      } else {
        currentList = null;
        blocks.push({ type: 'para', text: line });
      }
    }

    return (
      <>
        {blocks.map((b, idx) => {
          if (b.type === 'list' && b.items) {
            return (
              <ul key={`blk-${idx}`} className="list-disc pl-5 my-2 space-y-1">
                {b.items.map((it, i) => (
                  <li key={`blk-${idx}-it-${i}`} className="text-sm">{linkify(it, `blk-${idx}-it-${i}`)}</li>
                ))}
              </ul>
            );
          }
          // paragraph: render with interactive tokens and linkifying
          const text = (b.text || '').trim();
          if (!text) return <br key={`blk-${idx}-br`} />;
          return <p key={`blk-${idx}-p`} className="text-sm">{renderParagraph(text, `blk-${idx}`)}</p>;
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-card border-b border-transparent p-4">
        <h2 className="font-semibold text-lg text-gray-900 dark:text-white">{t('universityAssistant')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{`Hello ${firstName}, how can I help you today? Nice to see you.`}</p>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 p-4 space-y-4 overflow-y-auto"
        style={{ height: 'calc(100vh - 64px - 68px - 65px)' }}
      >
        {messages.length > 0 ? (
          messages.map((message) => {
            const { answer, sources } = parseMessageContent(message.content);
            
            return (
              <div
                key={message.id}
                className={`flex ${message.isUserMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[80%] p-3 mb-1 rounded-lg shadow-md text-gray-900 dark:text-white" style={{ background: message.isUserMessage ? 'hsl(var(--assistant-color))' : 'hsl(var(--muted))' }}>
                  <div className="whitespace-pre-wrap text-sm">
                    {renderContent(answer)}
                    
                    {/* sources removed */}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex justify-center items-center h-full">
            <p className="text-neutral-500">Send a message to start chatting</p>
          </div>
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="text-gray-900 dark:text-white p-3 rounded-lg flex items-center space-x-2" style={{background: 'hsl(var(--muted))'}}>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-900 dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-gray-900 dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-900 dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card border-t border-transparent p-3"
      >
        <div className="flex items-center">
          <Input
            type="text"
            placeholder={t('typeYourQuestion')}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="flex-1 rounded-full px-4 py-3 bg-popover/80 border border-transparent placeholder:text-neutral-400 text-gray-900 dark:text-white"
          />
          <Button
            type="submit"
            disabled={isSending || !userInput.trim()}
            className="ml-3 bg-[hsl(var(--primary))] text-white rounded-full p-3 hover:opacity-95 transition shadow-md"
          >
            <span className="material-icons">send</span>
          </Button>
        </div>
      </form>

      {/* sources UI removed */}
    </div>
  );
};

export default Chat;