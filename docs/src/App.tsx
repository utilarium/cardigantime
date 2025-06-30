import { useState, useEffect } from 'react'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorMessage from './components/ErrorMessage'
import MarkdownRenderer from './components/MarkdownRenderer'
import './App.css'

function App() {
    const [readme, setReadme] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Fetch README.md from the public directory
        fetch('./README.md')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch README: ${response.status}`)
                }
                return response.text()
            })
            .then(text => {
                setReadme(text)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div className="app">
                <LoadingSpinner />
            </div>
        )
    }

    if (error) {
        return (
            <div className="app">
                <ErrorMessage message={error} />
            </div>
        )
    }

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <div className="header-main">
                        <span className="icon">🧶</span>
                        <h1>Cardigantime</h1>
                    </div>
                    <p className="subtitle">Robust TypeScript Configuration Management</p>
                    <div className="header-links">
                        <a href="https://github.com/SemicolonAmbulance/cardigantime" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                        <a href="https://www.npmjs.com/package/@theunwalked/cardigantime" target="_blank" rel="noopener noreferrer">
                            NPM
                        </a>
                    </div>
                </div>
            </header>

            <main className="main">
                <div className="container">
                    <MarkdownRenderer content={readme} />
                </div>
            </main>

            <footer className="footer">
                <div className="container">
                    <p>
                        Built with ❤️ by{' '}
                        <a href="https://github.com/SemicolonAmbulance" target="_blank" rel="noopener noreferrer">
                            Semicolon Ambulance
                        </a>
                    </p>
                    <p className="license">Licensed under Apache-2.0</p>
                </div>
            </footer>
        </div>
    )
}

export default App 