// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: "情報マーケット | 副業・在宅ワークのお宝コラム",
    template: "%s | 情報マーケット"
  },
  description: "副業、在宅ワーク、安全な稼ぎ方を、アドバイザーのコウジが厳選して届けるお宝情報コラムサイト。初心者向けの実践ステップと安全なネットビジネスの見分け方を解説します。",
  metadataBase: new URL("https://www.jouhoumarket.com"),
  openGraph: {
    title: "情報マーケット",
    description: "副業、在宅ワーク、安全な稼ぎ方を、アドバイザーのコウジが厳選して届けるお宝情報コラムサイト。初心者向けの実践ステップと安全なネットビジネスの見分け方を解説します。",
    type: "website",
    locale: "ja_JP",
    url: "https://www.jouhoumarket.com",
    siteName: "情報マーケット",
  },
  twitter: {
    card: "summary_large_image",
    title: "情報マーケット",
    description: "副業、在宅ワーク、安全な稼ぎ方を、アドバイザー of コウジが厳選して届けるお宝情報コラムサイト。",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, backgroundColor: '#ffffff', color: '#333333' }}>
        {children}
      </body>
    </html>
  );
}
