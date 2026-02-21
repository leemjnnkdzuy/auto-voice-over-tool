import { Route } from "react-router-dom";

//Layouts
import { NothingLayout } from "@/components/layouts/NothingLayout";
import { HeaderLayout } from "@/components/layouts/HeaderLayout";

//Pages
import { HomePage } from "@/pages/HomePage";
import { ProjectPage } from "@/pages/ProjectPage";

const publicRoutes = [
	{
		path: "/",
		component: HomePage,
		layout: NothingLayout,
	},
	{
		path: "/project/:id",
		component: ProjectPage,
		layout: HeaderLayout,
	},
];

export const renderRoutes = () => (
	<>
		{publicRoutes.map((route, index) => {
			const Page = route.component;
			const Layout = route.layout;

			return (
				<Route
					key={index}
					path={route.path}
					element={
						<Layout>
							<Page />
						</Layout>
					}
				/>
			);
		})}
	</>
);

export { publicRoutes };
