import React, { type ReactNode } from "react";
import clsx from "clsx";
import Translate from "@docusaurus/Translate";
import type { Props } from "@theme/NotFound/Content";
import Heading from "@theme/Heading";
import Admonition from "@theme/Admonition";
import BrowserOnly from "@docusaurus/BrowserOnly";

const GOOGLE_DOCS_RE = /^[\w\d\-_]+$/;

const NotFoundBody = () => {
  const path = window.location.pathname.slice(1);
  const isDrive = path.match(GOOGLE_DOCS_RE) !== null;

  return (
    <div className="row">
      <div className="col col--8 col--offset-2">
        {isDrive ? (
          <Admonition type="info">
            It looks like this might be a link to an external Google Doc.{" "}
            <a
              href={`https://docs.google.com/document/d/${path}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              Click here to open it.
            </a>
          </Admonition>
        ) : (
          <Heading as="h1" className="hero__title">
            <Translate
              id="theme.NotFound.title"
              description="The title of the 404 page"
            >
              Page Not Found
            </Translate>
          </Heading>
        )}
        <p>
          <Translate
            id="theme.NotFound.p1"
            description="The first paragraph of the 404 page"
          >
            We could not find what you were looking for.
          </Translate>
        </p>
        <p>
          If you expected this page to exist, please let us know at{" "}
          <a href="mailto:contact@sustainablecapitolhill.org">
            contact@sustainablecapitolhill.org
          </a>
        </p>
      </div>
    </div>
  );
};

export default function NotFoundContent({ className }: Props): ReactNode {
  return (
    <main className={clsx("container margin-vert--xl", className)}>
      <BrowserOnly>{() => <NotFoundBody />}</BrowserOnly>
    </main>
  );
}
