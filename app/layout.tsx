import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Simmer — Turn recipes into stories',description:'A thoughtful video studio for your favorite recipes. Import, storyboard, and create AI cooking videos.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
