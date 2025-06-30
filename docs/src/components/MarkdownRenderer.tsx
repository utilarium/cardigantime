import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
    content: string
}

const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
    // Remove the first h1 from the markdown content only if it's "Cardigantime" to avoid duplicate headings
    const processedContent = content.replace(/^#\s+Cardigantime\s*$/m, '')

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match
                    return !isInline ? (
                        <SyntaxHighlighter
                            style={oneDark as any}
                            language={match[1]}
                            PreTag="div"
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code className={className} {...props}>
                            {children}
                        </code>
                    )
                }
            }}
        >
            {processedContent}
        </ReactMarkdown>
    )
}

export default MarkdownRenderer 