export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-4">
        <p className="text-center text-sm text-muted-foreground">
          © Designed and Development by Parth Joshi using{' '}
          <a
            href="https://lovable.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Lovable
          </a>
        </p>
      </div>
    </footer>
  );
}
