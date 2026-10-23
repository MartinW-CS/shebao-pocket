import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'保有数 · 我的社保账本',description:'看清每月缴费，了解每一份保障。上海社保、公积金与退休待遇情景测算。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
